import asyncio
import logging
import random
import re
import time
import uuid
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from django.contrib.auth import get_user_model

from .models import Session, Card, Note, Thread, SessionCharacter, TABLE_SETTINGS_DEFAULTS
from .serializers import (
    SessionListSerializer, SessionDetailSerializer, SessionCreateSerializer,
    CardSerializer, NoteSerializer, ThreadSerializer, SessionCharacterSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)

BROADCAST_TIMEOUT_S = 3
MAX_SKETCH_POINTS = 20_000
MAX_MUSIC_TRACKS = 100
YOUTUBE_ID_RE = re.compile(r'^[A-Za-z0-9_-]{6,20}$')


def clean_music(data):
    """Validate a music state posted by the master; raises ValidationError."""
    tracks = data.get('tracks')
    if not isinstance(tracks, list) or len(tracks) > MAX_MUSIC_TRACKS:
        raise ValidationError({'tracks': f'Expected a list of at most {MAX_MUSIC_TRACKS} tracks.'})
    clean_tracks = []
    for tr in tracks:
        video_id = tr.get('videoId') if isinstance(tr, dict) else None
        if not isinstance(video_id, str) or not YOUTUBE_ID_RE.match(video_id):
            raise ValidationError({'tracks': 'Invalid YouTube video id.'})
        if any(t['videoId'] == video_id for t in clean_tracks):
            continue
        title = tr.get('title')
        clean_tracks.append({'videoId': video_id, 'title': str(title)[:200] if title else video_id})

    current = data.get('current')
    if current is not None and current not in {t['videoId'] for t in clean_tracks}:
        raise ValidationError({'current': 'The current track must be in the playlist.'})
    try:
        offset = max(0.0, float(data.get('offset') or 0))
    except (TypeError, ValueError):
        raise ValidationError({'offset': 'Must be a number of seconds.'})
    return {
        'tracks': clean_tracks,
        'current': current,
        'playing': bool(data.get('playing')) and current is not None,
        'offset': offset,
        'updated_at': time.time(),
    }


def deny_if_board_locked(session, user, *touches_public):
    """A frozen shared table is read-only for players — the master is never blocked."""
    if session.master_id != user.id and session.settings['board_locked'] and any(touches_public):
        raise PermissionDenied(_('Майстер заморозив загальний стіл.'))


def deny_foreign_delete(session, user, created_by_id):
    """Players always may delete their own things, never the master's, and
    other players' only if the master allowed it."""
    if session.master_id == user.id or created_by_id == user.id:
        return
    if created_by_id == session.master_id:
        raise PermissionDenied(_('Не можна видалити картку майстра.'))
    if not session.settings['players_delete_others']:
        raise PermissionDenied(_('Майстер заборонив видаляти чуже.'))


def music_payload(music):
    # server_now lets each client place the track position without trusting its own clock
    return {'music': music or {}, 'server_now': time.time()}


def broadcast(session_id, message):
    """Best-effort real-time fan-out. The DB write has already happened by now,
    so a slow or unreachable Redis must never hang or fail the HTTP request."""
    channel_layer = get_channel_layer()

    async def _send():
        await asyncio.wait_for(
            channel_layer.group_send(f'session_{session_id}', message),
            timeout=BROADCAST_TIMEOUT_S,
        )

    try:
        async_to_sync(_send)()
    except Exception as e:
        logger.warning('broadcast %s to session %s failed: %r', message.get('type'), session_id, e)


class SessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Session.objects.filter(
            Q(master=user) | Q(players=user)
        ).distinct().prefetch_related('players').select_related('master')

    def get_serializer_class(self):
        if self.action == 'create':
            return SessionCreateSerializer
        if self.action == 'list':
            return SessionListSerializer
        return SessionDetailSerializer

    def perform_update(self, serializer):
        if serializer.instance.master != self.request.user:
            raise PermissionDenied(_('Тільки майстер може змінювати сесію.'))
        serializer.save()

    def perform_destroy(self, instance):
        if instance.master != self.request.user:
            raise PermissionDenied(_('Тільки майстер може видалити сесію.'))
        instance.delete()

    def create(self, request, *args, **kwargs):
        serializer = SessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save(master=request.user)
        return Response(
            SessionDetailSerializer(session, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        try:
            session = Session.objects.get(pk=pk)
        except Session.DoesNotExist:
            return Response({'error': _('Сесію не знайдено.')}, status=status.HTTP_404_NOT_FOUND)
        if session.status == 'closed':
            return Response({'error': _('Сесія закрита.')}, status=status.HTTP_400_BAD_REQUEST)
        if session.master == request.user:
            return Response({'error': _('Ви майстер цієї сесії.')}, status=status.HTTP_400_BAD_REQUEST)
        session.players.add(request.user)
        broadcast(session.id, {
            'type': 'player.joined',
            'user_id': request.user.id,
            'username': request.user.username,
        })
        return Response(SessionDetailSerializer(session, context={'request': request}).data)

    @action(detail=False, methods=['post'], url_path='join-by-code')
    def join_by_code(self, request):
        code = request.data.get('code', '').strip().upper()
        if not code:
            return Response({'error': _('Введіть код сесії.')}, status=status.HTTP_400_BAD_REQUEST)
        try:
            session = Session.objects.get(join_code=code)
        except Session.DoesNotExist:
            return Response({'error': _('Сесію з таким кодом не знайдено.')}, status=status.HTTP_404_NOT_FOUND)
        if session.status == 'closed':
            return Response({'error': _('Сесія закрита.')}, status=status.HTTP_400_BAD_REQUEST)
        if session.master == request.user:
            return Response(SessionDetailSerializer(session, context={'request': request}).data)
        session.players.add(request.user)
        broadcast(session.id, {
            'type': 'player.joined',
            'user_id': request.user.id,
            'username': request.user.username,
        })
        return Response(SessionDetailSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        session = self.get_object()
        if session.master == request.user:
            return Response({'error': _('Майстер не може покинути сесію.')}, status=status.HTTP_400_BAD_REQUEST)
        session.players.remove(request.user)
        return Response({'status': 'left'})

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        session = self.get_object()
        if session.master != request.user:
            return Response({'error': _('Тільки майстер може розпочати сесію.')}, status=status.HTTP_403_FORBIDDEN)
        session.status = 'active'
        session.save()
        return Response(SessionDetailSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        session = self.get_object()
        if session.master != request.user:
            return Response({'error': _('Тільки майстер може закрити сесію.')}, status=status.HTTP_403_FORBIDDEN)
        session.status = 'closed'
        session.save()
        return Response(SessionDetailSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['get', 'post'])
    def music(self, request, pk=None):
        session = self.get_object()
        if request.method == 'GET':
            return Response(music_payload(session.music))
        if session.master != request.user:
            raise PermissionDenied(_('Тільки майстер керує музикою.'))
        session.music = clean_music(request.data)
        session.save(update_fields=['music'])
        payload = music_payload(session.music)
        broadcast(session.id, {'type': 'music.updated', **payload})
        return Response(payload)

    @action(detail=True, methods=['post'], url_path='table-settings')
    def table_settings(self, request, pk=None):
        session = self.get_object()
        if session.master != request.user:
            raise PermissionDenied(_('Тільки майстер змінює налаштування столу.'))
        changes = {k: v for k, v in request.data.items() if k in TABLE_SETTINGS_DEFAULTS}
        if not all(isinstance(v, bool) for v in changes.values()):
            raise ValidationError({'detail': 'Settings must be true or false.'})
        session.table_settings = {**session.settings, **changes}
        session.save(update_fields=['table_settings'])
        broadcast(session.id, {'type': 'session.settings', 'table_settings': session.settings})
        return Response(session.settings)

    @action(detail=True, methods=['post'], url_path='set-character')
    def set_character(self, request, pk=None):
        session = self.get_object()
        if session.master == request.user:
            return Response({'error': _('Майстер не вибирає персонажа.')}, status=status.HTTP_400_BAD_REQUEST)
        character_id = request.data.get('character_id')
        if not character_id:
            SessionCharacter.objects.filter(session=session, player=request.user).delete()
            return Response({'status': 'unbound'})
        from apps.characters.models import Character
        try:
            character = Character.objects.get(id=character_id, user=request.user)
        except Character.DoesNotExist:
            return Response({'error': _('Персонажа не знайдено.')}, status=status.HTTP_404_NOT_FOUND)
        obj, _created = SessionCharacter.objects.update_or_create(
            session=session, player=request.user,
            defaults={'character': character},
        )
        return Response(SessionCharacterSerializer(obj).data)

    @action(detail=True, methods=['get'], url_path='my-character')
    def my_character(self, request, pk=None):
        session = self.get_object()
        try:
            binding = SessionCharacter.objects.get(session=session, player=request.user)
            return Response(SessionCharacterSerializer(binding).data)
        except SessionCharacter.DoesNotExist:
            return Response(None, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='load-campaign')
    def load_campaign(self, request, pk=None):
        session = self.get_object()
        if session.master != request.user:
            return Response({'error': _('Тільки майстер може завантажити кампанію.')}, status=status.HTTP_403_FORBIDDEN)
        campaign_id = request.data.get('campaign_id')
        if not campaign_id:
            return Response({'error': _('Вкажіть campaign_id.')}, status=status.HTTP_400_BAD_REQUEST)
        from apps.campaigns.models import Campaign, CampaignAsset
        try:
            campaign = Campaign.objects.get(pk=campaign_id, master=request.user)
        except Campaign.DoesNotExist:
            return Response({'error': _('Кампанію не знайдено.')}, status=status.HTTP_404_NOT_FOUND)
        assets = list(CampaignAsset.objects.filter(campaign=campaign))
        npcs = list(campaign.npcs.all())
        if not assets and not npcs:
            return Response({'error': _('У кампанії немає ассетів.')}, status=status.HTTP_400_BAD_REQUEST)
        COLS = 4
        CARD_W, CARD_H, GAP = 220, 160, 24
        cards = []
        for i, asset in enumerate(assets):
            col = i % COLS
            row = i // COLS
            cards.append(Card(
                session=session,
                type=asset.type,
                title=asset.title,
                content=asset.content,
                image=asset.image if asset.image else None,
                created_by=request.user,
                owner=None,
                is_public=False,
                pos_x=col * (CARD_W + GAP),
                pos_y=row * (CARD_H + GAP),
            ))
        for j, npc in enumerate(npcs):
            i = len(assets) + j
            col = i % COLS
            row = i // COLS
            content = '\n\n'.join(filter(None, [npc.occupation, npc.appearance, npc.description]))
            cards.append(Card(
                session=session,
                type='npc',
                title=npc.name,
                content=content,
                image=npc.portrait_image if npc.portrait_image else None,
                created_by=request.user,
                owner=None,
                is_public=False,
                pos_x=col * (CARD_W + GAP),
                pos_y=row * (CARD_H + GAP),
            ))
        created_objs = Card.objects.bulk_create(cards)
        created_ids = [c.id for c in created_objs]
        created_qs = Card.objects.filter(id__in=created_ids).select_related('created_by', 'owner')
        return Response({
            'created': len(created_ids),
            'cards': CardSerializer(created_qs, many=True, context={'request': request}).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def roll(self, request, pk=None):
        session = self.get_object()
        if session.master != request.user:
            return Response({'error': _('Тільки майстер може кидати кубики на столі.')}, status=status.HTTP_403_FORBIDDEN)
        DICE = {'d4': 4, 'd6': 6, 'd8': 8, 'd10': 10, 'd100': 100}
        dice_type = request.data.get('dice_type', 'd100')
        if dice_type not in DICE:
            return Response({'error': _('Невідомий тип кубика.')}, status=status.HTTP_400_BAD_REQUEST)
        try:
            count = max(1, min(10, int(request.data.get('count', 1))))
        except (TypeError, ValueError):
            return Response({'error': _('Невірна кількість кубиків.')}, status=status.HTTP_400_BAD_REQUEST)
        sides = DICE[dice_type]
        results = [random.randint(1, sides) for _ in range(count)]
        total = sum(results)
        payload = {
            'roll_id': uuid.uuid4().hex,
            'dice_type': dice_type, 'count': count,
            'results': results, 'total': total,
            'rolled_by': request.user.username,
            'rolled_by_id': request.user.id,
            'character_name': None,
            'skill_name': None,
            'tier': None,
            'visible_to_all': True,
        }
        broadcast(pk, {'type': 'dice.rolled', **payload})
        return Response(payload)


class SessionMixin:
    def get_session(self):
        session_pk = self.kwargs['session_pk']
        user = self.request.user
        try:
            session = Session.objects.get(pk=session_pk)
        except Session.DoesNotExist:
            raise NotFound(_('Сесію не знайдено.'))
        if not session.is_participant(user):
            raise PermissionDenied(_('Ви не учасник цієї сесії.'))
        return session


# A table loads everything at once — a paginated board would silently drop
# whatever sits past the first page on reload.
class CardViewSet(SessionMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CardSerializer
    pagination_class = None

    def validate_relations(self, serializer, session):
        """The serializer accepts any user/card id — keep them inside this session."""
        data = serializer.validated_data
        owner = data.get('owner')
        if owner is not None and not session.is_participant(owner):
            raise ValidationError({'owner_id': _('Власник не є учасником сесії.')})
        parent_map = data.get('parent_map')
        if parent_map is not None and (parent_map.session_id != session.id or parent_map.type != 'map'):
            raise ValidationError({'parent_map_id': _('Мапу не знайдено в цій сесії.')})

    def get_queryset(self):
        session = self.get_session()
        user = self.request.user
        if session.master == user:
            return Card.objects.filter(session=session).select_related('created_by', 'owner')
        return Card.objects.filter(
            Q(session=session, is_public=True) |
            Q(session=session, owner=user)
        ).select_related('created_by', 'owner')

    def perform_create(self, serializer):
        session = self.get_session()
        self.validate_relations(serializer, session)
        deny_if_board_locked(session, self.request.user, serializer.validated_data.get('is_public', False))
        card = serializer.save(session=session, created_by=self.request.user)
        if card.is_public or card.owner_id:
            broadcast(session.id, {
                'type': 'card.created',
                'card': CardSerializer(card, context={'request': self.request}).data,
            })

    def perform_update(self, serializer):
        session = self.get_session()
        position_only = set(serializer.validated_data.keys()) <= {'pos_x', 'pos_y'}
        if not position_only and (
            serializer.instance.created_by != self.request.user
            and session.master != self.request.user
        ):
            raise PermissionDenied(_('Недостатньо прав для редагування цієї картки.'))
        deny_if_board_locked(session, self.request.user, serializer.instance.is_public)
        self.validate_relations(serializer, session)
        card = serializer.save()
        if position_only:
            broadcast(session.id, {
                'type': 'card.moved',
                'card_id': card.id,
                'pos_x': card.pos_x,
                'pos_y': card.pos_y,
                'moved_by': self.request.user.id,
            })
        else:
            broadcast(session.id, {
                'type': 'card.updated',
                'card': CardSerializer(card, context={'request': self.request}).data,
            })

    def perform_destroy(self, instance):
        session = self.get_session()
        deny_foreign_delete(session, self.request.user, instance.created_by_id)
        deny_if_board_locked(session, self.request.user, instance.is_public)
        session_id = instance.session_id
        card_id = instance.id
        # Pins cascade-delete in the DB with their parent map, but that doesn't
        # fire per-object signals — broadcast their removal explicitly too.
        pin_ids = list(instance.pins.values_list('id', flat=True))
        instance.delete()
        broadcast(session_id, {'type': 'card.deleted', 'card_id': card_id})
        for pin_id in pin_ids:
            broadcast(session_id, {'type': 'card.deleted', 'card_id': pin_id})

    @action(detail=True, methods=['post'])
    def publish(self, request, session_pk=None, pk=None):
        card = self.get_object()
        session = self.get_session()
        if request.user != session.master and request.user != card.owner:
            return Response({'error': _('Недостатньо прав.')}, status=status.HTTP_403_FORBIDDEN)
        deny_if_board_locked(session, request.user, True)
        card.is_public = True
        card.save()
        data = CardSerializer(card, context={'request': request}).data
        broadcast(session.id, {'type': 'card.published', 'card': data})
        return Response(data)

    @action(detail=True, methods=['post'])
    def take(self, request, session_pk=None, pk=None):
        """Take a card off the shared table: a player into their personal space
        (only cards they made), the master into theirs (any card)."""
        card = self.get_object()
        session = self.get_session()
        user = request.user
        if not card.is_public or card.type == 'pin':
            return Response({'error': _('Цю картку не можна забрати.')}, status=status.HTTP_400_BAD_REQUEST)
        if session.master != user:
            if card.created_by != user:
                raise PermissionDenied(_('Забрати можна тільки свою картку.'))
            if not session.settings['players_take_cards']:
                raise PermissionDenied(_('Майстер заборонив забирати картки зі столу.'))
            deny_if_board_locked(session, user, True)
        # A map's pins go wherever the map goes
        moved = [card, *card.pins.all()] if card.type == 'map' else [card]
        for c in moved:
            c.is_public = False
            c.owner = user
            c.save(update_fields=['is_public', 'owner'])
            broadcast(session.id, {
                'type': 'card.unpublished',
                'card': CardSerializer(c, context={'request': request}).data,
            })
        return Response(CardSerializer(card, context={'request': request}).data)

    @action(detail=True, methods=['patch'])
    def drawing(self, request, session_pk=None, pk=None):
        card = self.get_object()
        if card.type != 'sketch':
            return Response({'error': 'Only sketch cards support drawing.'}, status=status.HTTP_400_BAD_REQUEST)
        if request.data.get('clear'):
            session = self.get_session()
            if request.user != session.master and request.user != card.created_by:
                return Response({'error': _('Недостатньо прав.')}, status=status.HTTP_403_FORBIDDEN)
            card.drawing_data = []
        else:
            new_strokes = request.data.get('strokes', [])
            if not isinstance(new_strokes, list) or not all(isinstance(s, list) for s in new_strokes):
                return Response({'error': 'Invalid strokes format.'}, status=status.HTTP_400_BAD_REQUEST)
            # Every append is re-sent to the whole table — keep a sketch bounded
            total_points = sum(len(s) for s in card.drawing_data) + sum(len(s) for s in new_strokes)
            if total_points > MAX_SKETCH_POINTS:
                return Response({'error': _('Ескіз переповнений — очистіть його.')}, status=status.HTTP_400_BAD_REQUEST)
            card.drawing_data = card.drawing_data + new_strokes
        card.save(update_fields=['drawing_data'])
        data = CardSerializer(card, context={'request': request}).data
        broadcast(card.session_id, {'type': 'card.updated', 'card': data})
        return Response(data)

    @action(detail=True, methods=['post'])
    def pin(self, request, session_pk=None, pk=None):
        card = self.get_object()
        session = self.get_session()
        if request.user != session.master and request.user != card.created_by:
            return Response({'error': _('Недостатньо прав.')}, status=status.HTTP_403_FORBIDDEN)
        deny_if_board_locked(session, request.user, card.is_public)
        card.is_pinned = not card.is_pinned
        card.save(update_fields=['is_pinned'])
        data = CardSerializer(card, context={'request': request}).data
        broadcast(session.id, {'type': 'card.updated', 'card': data})
        return Response(data)

    @action(detail=True, methods=['post'])
    def transfer(self, request, session_pk=None, pk=None):
        card = self.get_object()
        session = self.get_session()
        if request.user != card.owner and session.master != request.user:
            return Response({'error': _('Недостатньо прав.')}, status=status.HTTP_403_FORBIDDEN)
        if session.master != request.user and not session.settings['players_transfer']:
            raise PermissionDenied(_('Майстер заборонив передавати картки.'))
        if card.is_public:
            return Response({'error': _('Публічну картку не можна передати.')}, status=status.HTTP_400_BAD_REQUEST)
        target_user_id = request.data.get('target_user_id')
        if not target_user_id:
            return Response({'error': _('Вкажіть отримувача.')}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target_user = User.objects.get(pk=target_user_id)
        except User.DoesNotExist:
            return Response({'error': _('Користувача не знайдено.')}, status=status.HTTP_404_NOT_FOUND)
        if not session.is_participant(target_user):
            return Response({'error': _('Отримувач не є учасником сесії.')}, status=status.HTTP_400_BAD_REQUEST)
        from_user_id = card.owner_id
        card.owner = target_user
        card.save(update_fields=['owner'])
        data = CardSerializer(card, context={'request': request}).data
        broadcast(session.id, {
            'type': 'card.transferred',
            'card': data,
            'from_user_id': from_user_id,
        })
        return Response(data)


class ThreadViewSet(SessionMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ThreadSerializer
    pagination_class = None

    def get_queryset(self):
        session = self.get_session()
        return Thread.objects.filter(session=session).select_related('created_by', 'card_from', 'card_to')

    def perform_create(self, serializer):
        from django.db import IntegrityError
        session = self.get_session()
        for field in ('card_from', 'card_to'):
            if serializer.validated_data[field].session_id != session.id:
                raise ValidationError({f'{field}_id': _('Картку не знайдено в цій сесії.')})
        deny_if_board_locked(
            session, self.request.user,
            serializer.validated_data['card_from'].is_public, serializer.validated_data['card_to'].is_public,
        )
        try:
            thread = serializer.save(session=session, created_by=self.request.user)
        except IntegrityError:
            raise ValidationError({'detail': 'Нитка між цими картками вже існує.'})
        broadcast(session.id, {
            'type': 'thread.created',
            'thread': ThreadSerializer(thread).data,
        })

    def perform_destroy(self, instance):
        session = self.get_session()
        deny_foreign_delete(session, self.request.user, instance.created_by_id)
        deny_if_board_locked(session, self.request.user, instance.card_from.is_public, instance.card_to.is_public)
        session_id = instance.session_id
        thread_id = instance.id
        card_from = instance.card_from
        card_to = instance.card_to
        instance.delete()
        broadcast(session_id, {'type': 'thread.deleted', 'thread_id': thread_id})

        # A pin exists only to anchor a thread on a map — once its last
        # thread is gone, drop the pin too instead of leaving it stranded.
        for card in (card_from, card_to):
            if card.type != 'pin':
                continue
            if Thread.objects.filter(Q(card_from=card) | Q(card_to=card)).exists():
                continue
            card_id = card.id
            card.delete()
            broadcast(session_id, {'type': 'card.deleted', 'card_id': card_id})


class NoteViewSet(SessionMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NoteSerializer
    pagination_class = None

    def get_queryset(self):
        session = self.get_session()
        user = self.request.user
        return Note.objects.filter(
            Q(session=session, is_private=False) |
            Q(session=session, is_private=True, author=user)
        ).select_related('author')

    def perform_create(self, serializer):
        session = self.get_session()
        note = serializer.save(session=session, author=self.request.user)
        if not note.is_private:
            broadcast(session.id, {
                'type': 'note.created',
                'note': NoteSerializer(note).data,
            })

    def update(self, request, *args, **kwargs):
        note = self.get_object()
        if note.author != request.user:
            return Response({'error': _('Ви не автор цієї нотатки.')}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        note = serializer.save()
        if not note.is_private:
            broadcast(note.session_id, {
                'type': 'note.updated',
                'note': NoteSerializer(note).data,
            })

    def destroy(self, request, *args, **kwargs):
        note = self.get_object()
        if note.author != request.user:
            return Response({'error': _('Ви не автор цієї нотатки.')}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        session_id = instance.session_id
        note_id = instance.id
        is_public = not instance.is_private
        instance.delete()
        if is_public:
            broadcast(session_id, {'type': 'note.deleted', 'note_id': note_id})
