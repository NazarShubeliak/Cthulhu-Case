import random
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Character, Skill, DiceRoll, Equipment, MentalScar
from .serializers import (
    CharacterSerializer, CharacterListSerializer, DiceRollSerializer, SkillSerializer,
    EquipmentSerializer, MentalScarSerializer,
)

DEFAULT_SKILLS = [
    ("Бібліотечна справа", 20),
    ("Комп'ютери", 5),
    ("Мистецтво", 5),
    ("Маскування", 20),
    ("Медицина", 1),
    ("Навігація", 10),
    ("Окультизм", 5),
    ("Перша допомога", 30),
    ("Переконання", 15),
    ("Психологія", 10),
    ("Скрадання", 20),
    ("Спостережливість", 25),
    ("Стрільба (пістолет)", 20),
    ("Стрільба (гвинтівка)", 25),
    ("Фізика", 1),
    ("Бойові мистецтва", 1),
    ("Водіння", 20),
    ("Дресирування", 5),
    ("Латина", 1),
    ("Рукопашний бій", 25),
]


def roll_dice(dice_type: str, count: int) -> tuple[list[int], int]:
    """Roll dice and return (individual results, total)."""
    sides_map = {
        'd4': 4, 'd6': 6, 'd8': 8, 'd10': 10, 'd100': 100,
    }

    if dice_type == 'd100':
        results = []
        for _ in range(count):
            tens = random.randint(0, 9)
            units = random.randint(0, 9)
            value = tens * 10 + units
            if value == 0:
                value = 100
            results.append(value)
        return results, sum(results)

    sides = sides_map.get(dice_type)
    if not sides:
        raise ValueError(f'Невідомий тип кубика: {dice_type}')

    results = [random.randint(1, sides) for _ in range(count)]
    return results, sum(results)


def recalculate_derived(character, data):
    """Recalculate derived stats based on core stats."""
    con = data.get('con_stat', character.con_stat)
    siz = data.get('siz_stat', character.siz_stat)
    pow_val = data.get('pow_stat', character.pow_stat)

    new_hp_max = (con + siz) // 10
    new_mp_max = pow_val // 5
    new_sanity_max = 99

    updates = {
        'hp_max': new_hp_max,
        'mp_max': new_mp_max,
        'sanity_max': new_sanity_max,
    }

    # If current exceeds new max, cap it
    if character.hp_current > new_hp_max:
        updates['hp_current'] = new_hp_max
    if character.mp_current > new_mp_max:
        updates['mp_current'] = new_mp_max

    return updates


class CharacterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Character.objects.filter(user=self.request.user).prefetch_related('skills')

    def get_serializer_class(self):
        if self.action == 'list':
            return CharacterListSerializer
        return CharacterSerializer

    def perform_create(self, serializer):
        character = serializer.save(user=self.request.user)

        # Calculate initial derived stats
        hp_max = (character.con_stat + character.siz_stat) // 10
        mp_max = character.pow_stat // 5
        character.hp_max = hp_max
        character.hp_current = hp_max
        character.mp_max = mp_max
        character.mp_current = mp_max
        character.sanity_max = 99
        character.sanity_current = character.pow_stat
        character.sanity_starting = character.pow_stat
        character.save()

        # Create default skills
        skills_to_create = [
            Skill(
                character=character,
                name=name,
                base_value=base,
                current_value=base,
            )
            for name, base in DEFAULT_SKILLS
        ]
        Skill.objects.bulk_create(skills_to_create)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        stat_fields = {
            'str_stat', 'con_stat', 'siz_stat', 'dex_stat',
            'app_stat', 'int_stat', 'pow_stat', 'edu_stat',
        }
        has_stat_change = any(f in request.data for f in stat_fields)

        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        if has_stat_change:
            derived = recalculate_derived(instance, serializer.validated_data)
            serializer.save(**derived)
        else:
            serializer.save()

        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def roll(self, request, pk=None):
        character = self.get_object()
        dice_type = request.data.get('dice_type', 'd100')
        dice_count = int(request.data.get('dice_count', 1))
        skill_id = request.data.get('skill_id')
        raw_visible = request.data.get('visible_to_all', True)
        visible_to_all = raw_visible not in (False, 'false', '0', 'no', 0)

        if dice_type not in ('d4', 'd6', 'd8', 'd10', 'd100'):
            return Response(
                {'error': 'Невідомий тип кубика. Допустимі: d4, d6, d8, d10, d100'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if dice_count < 1 or dice_count > 20:
            return Response(
                {'error': 'Кількість кубиків має бути від 1 до 20.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        skill = None
        if skill_id:
            try:
                skill = Skill.objects.get(id=skill_id, character=character)
            except Skill.DoesNotExist:
                return Response(
                    {'error': 'Навичку не знайдено.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        results, total = roll_dice(dice_type, dice_count)

        dice_roll = DiceRoll.objects.create(
            character=character,
            dice_type=dice_type,
            dice_count=dice_count,
            results=results,
            total=total,
            skill=skill,
            visible_to_all=visible_to_all,
        )

        # Determine CoC success tier for d100 skill rolls
        tier = None
        if dice_type == 'd100' and skill and dice_count == 1:
            val = total
            skill_val = skill.current_value
            if val <= 5:
                tier = 'critical'
            elif val <= skill_val // 5:
                tier = 'extreme'
            elif val <= skill_val // 2:
                tier = 'hard'
            elif val <= skill_val:
                tier = 'regular'
            elif val >= 96:
                tier = 'fumble'
            else:
                tier = 'failure'

        data = DiceRollSerializer(dice_roll).data
        data['tier'] = tier

        # Broadcast to all sessions this character is bound to
        try:
            from apps.game_sessions.models import SessionCharacter
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            bindings = SessionCharacter.objects.filter(character=character)
            channel_layer = get_channel_layer()
            payload = {
                'type': 'dice.rolled',
                'dice_type': dice_type,
                'count': dice_count,
                'results': results,
                'total': total,
                'rolled_by': request.user.username,
                'rolled_by_id': request.user.id,
                'character_name': character.name,
                'skill_name': skill.name if skill else None,
                'tier': tier,
                'visible_to_all': bool(visible_to_all),
            }
            for binding in bindings:
                async_to_sync(channel_layer.group_send)(f'session_{binding.session_id}', payload)
        except Exception:
            pass

        return Response(data, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=['post'], url_path='improve-skills')
    def improve_skills(self, request, pk=None):
        character = self.get_object()
        checked_skills = list(character.skills.filter(checked=True))

        if not checked_skills:
            return Response(
                {'error': 'Немає позначених навичок для підвищення.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        for skill in checked_skills:
            d100 = random.randint(1, 100)
            old_value = skill.current_value
            improvement = 0

            if d100 > old_value:
                improvement = random.randint(1, 10)
                skill.current_value = min(99, old_value + improvement)

            skill.checked = False
            skill.save(update_fields=['current_value', 'checked'])

            results.append({
                'skill_id': skill.id,
                'name': skill.name,
                'old_value': old_value,
                'roll': d100,
                'improved': improvement > 0,
                'improvement': improvement,
                'new_value': skill.current_value,
            })

        return Response({'results': results})


class SkillViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SkillSerializer

    def get_queryset(self):
        character = get_object_or_404(
            Character, pk=self.kwargs['character_pk'], user=self.request.user
        )
        return Skill.objects.filter(character=character)


class EquipmentViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = EquipmentSerializer

    def get_queryset(self):
        character = get_object_or_404(
            Character, pk=self.kwargs['character_pk'], user=self.request.user
        )
        return Equipment.objects.filter(character=character)

    def perform_create(self, serializer):
        character = get_object_or_404(
            Character, pk=self.kwargs['character_pk'], user=self.request.user
        )
        serializer.save(character=character)


class MentalScarViewSet(
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = MentalScarSerializer

    def get_queryset(self):
        character = get_object_or_404(
            Character, pk=self.kwargs['character_pk'], user=self.request.user
        )
        return MentalScar.objects.filter(character=character)

    def perform_create(self, serializer):
        character = get_object_or_404(
            Character, pk=self.kwargs['character_pk'], user=self.request.user
        )
        serializer.save(character=character)
