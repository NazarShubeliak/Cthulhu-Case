from rest_framework import serializers
from apps.users.serializers import UserSerializer
from .models import Campaign, Act, Scene, NPC, CampaignAsset


class CampaignAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignAsset
        fields = ['id', 'campaign', 'type', 'title', 'content', 'image', 'order']
        read_only_fields = ['campaign']


class NPCSerializer(serializers.ModelSerializer):
    class Meta:
        model = NPC
        fields = ['id', 'campaign', 'name', 'age', 'occupation', 'appearance', 'status',
                  'description', 'secret_info', 'portrait_image']
        read_only_fields = ['campaign']


class SceneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scene
        fields = ['id', 'act', 'title', 'description', 'master_notes', 'order']
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
    acts = ActSerializer(many=True, read_only=True)

    class Meta:
        model = Campaign
        fields = ['id', 'master', 'title', 'description', 'setting', 'era',
                  'acts', 'created_at', 'updated_at']
        read_only_fields = ['master', 'created_at', 'updated_at']


class CampaignListSerializer(serializers.ModelSerializer):
    master = UserSerializer(read_only=True)
    act_count = serializers.SerializerMethodField()
    asset_count = serializers.SerializerMethodField()
    npc_count = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = ['id', 'master', 'title', 'setting', 'era', 'act_count', 'asset_count', 'npc_count', 'created_at']

    def get_act_count(self, obj):
        return obj.acts.count()

    def get_asset_count(self, obj):
        return obj.assets.count()

    def get_npc_count(self, obj):
        return obj.npcs.count()
