from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.users.serializers import UserSerializer
from apps.game_sessions.models import Card
from apps.game_sessions.serializers import CardSerializer
from .models import Campaign, Act, Scene, NPC, SceneCard

User = get_user_model()


class SceneCardSerializer(serializers.ModelSerializer):
    card = CardSerializer(read_only=True)
    card_id = serializers.PrimaryKeyRelatedField(
        write_only=True, source='card', queryset=Card.objects.all()
    )
    sent_to = UserSerializer(read_only=True)
    sent_to_id = serializers.PrimaryKeyRelatedField(
        write_only=True, source='sent_to',
        required=False, allow_null=True,
        queryset=User.objects.all()
    )

    class Meta:
        model = SceneCard
        fields = ['id', 'scene', 'card', 'card_id', 'sent_to', 'sent_to_id', 'is_sent']
        read_only_fields = ['scene', 'card', 'sent_to', 'is_sent']


class NPCSerializer(serializers.ModelSerializer):
    scene_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, source='scenes',
        queryset=Scene.objects.all(), required=False
    )
    scenes = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = NPC
        fields = ['id', 'campaign', 'name', 'description', 'secret_info',
                  'portrait_image', 'scenes', 'scene_ids']
        read_only_fields = ['campaign']

    def create(self, validated_data):
        scenes = validated_data.pop('scenes', [])
        npc = NPC.objects.create(**validated_data)
        if scenes:
            npc.scenes.set(scenes)
        return npc

    def update(self, instance, validated_data):
        scenes = validated_data.pop('scenes', None)
        instance = super().update(instance, validated_data)
        if scenes is not None:
            instance.scenes.set(scenes)
        return instance


class SceneSerializer(serializers.ModelSerializer):
    npcs = NPCSerializer(many=True, read_only=True)
    scene_cards = SceneCardSerializer(many=True, read_only=True)

    class Meta:
        model = Scene
        fields = ['id', 'act', 'title', 'description', 'master_notes',
                  'order', 'npcs', 'scene_cards']
        read_only_fields = ['act']


class SceneListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scene
        fields = ['id', 'act', 'title', 'order']
        read_only_fields = ['act']


class ActSerializer(serializers.ModelSerializer):
    scenes = SceneListSerializer(many=True, read_only=True)

    class Meta:
        model = Act
        fields = ['id', 'campaign', 'title', 'order', 'scenes']
        read_only_fields = ['campaign']


class ActListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Act
        fields = ['id', 'campaign', 'title', 'order']
        read_only_fields = ['campaign']


class CampaignSerializer(serializers.ModelSerializer):
    master = UserSerializer(read_only=True)
    acts = ActListSerializer(many=True, read_only=True)

    class Meta:
        model = Campaign
        fields = ['id', 'master', 'title', 'description', 'setting', 'era',
                  'acts', 'created_at', 'updated_at']
        read_only_fields = ['master', 'created_at', 'updated_at']


class CampaignListSerializer(serializers.ModelSerializer):
    master = UserSerializer(read_only=True)
    act_count = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = ['id', 'master', 'title', 'setting', 'era', 'act_count', 'created_at']

    def get_act_count(self, obj):
        return obj.acts.count()
