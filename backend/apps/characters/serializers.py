from rest_framework import serializers
from .models import Character, Skill, DiceRoll


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ('id', 'character', 'name', 'base_value', 'current_value', 'checked')
        read_only_fields = ('id',)


class DiceRollSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiceRoll
        fields = (
            'id', 'character', 'dice_type', 'dice_count',
            'results', 'total', 'skill', 'visible_to_all', 'created_at',
        )
        read_only_fields = ('id', 'results', 'total', 'created_at')


class CharacterSerializer(serializers.ModelSerializer):
    skills = SkillSerializer(many=True, read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Character
        fields = (
            'id', 'user', 'name', 'occupation', 'age', 'residence', 'birthplace',
            'backstory', 'portrait_image',
            'str_stat', 'con_stat', 'siz_stat', 'dex_stat',
            'app_stat', 'int_stat', 'pow_stat', 'edu_stat',
            'hp_current', 'hp_max', 'mp_current', 'mp_max',
            'sanity_current', 'sanity_max', 'sanity_starting',
            'luck_current', 'luck_max',
            'skills', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')


class CharacterListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Character
        fields = (
            'id', 'name', 'occupation', 'age', 'portrait_image',
            'hp_current', 'hp_max', 'sanity_current', 'sanity_max', 'updated_at',
        )
        read_only_fields = fields
