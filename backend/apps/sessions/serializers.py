from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.users.serializers import UserSerializer
from .models import Session, Card, Note

User = get_user_model()


class SessionListSerializer(serializers.ModelSerializer):
    master = UserSerializer(read_only=True)
    player_count = serializers.SerializerMethodField()
    is_master = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ['id', 'name', 'description', 'status', 'master', 'player_count', 'is_master', 'created_at']

    def get_player_count(self, obj):
        return obj.players.count()

    def get_is_master(self, obj):
        request = self.context.get('request')
        return request and obj.master == request.user


class SessionDetailSerializer(serializers.ModelSerializer):
    master = UserSerializer(read_only=True)
    players = UserSerializer(many=True, read_only=True)
    is_master = serializers.SerializerMethodField()
    is_participant = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ['id', 'name', 'description', 'status', 'master', 'players',
                  'is_master', 'is_participant', 'created_at']

    def get_is_master(self, obj):
        request = self.context.get('request')
        return request and obj.master == request.user

    def get_is_participant(self, obj):
        request = self.context.get('request')
        return request and obj.is_participant(request.user)


class SessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ['name', 'description']


class CardSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    owner = UserSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='owner',
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Card
        fields = ['id', 'session', 'type', 'title', 'content', 'image',
                  'created_by', 'owner', 'owner_id', 'is_public',
                  'pos_x', 'pos_y', 'created_at', 'updated_at']
        read_only_fields = ['session', 'created_by', 'created_at', 'updated_at']


class NoteSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Note
        fields = ['id', 'session', 'author', 'content', 'is_private', 'created_at', 'updated_at']
        read_only_fields = ['session', 'author', 'created_at', 'updated_at']
