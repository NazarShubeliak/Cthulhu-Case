from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.users.serializers import UserSerializer
from .models import Session, Card, Note, Thread, SessionCharacter

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
                  'is_master', 'is_participant', 'join_code', 'created_at']

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
    image = serializers.SerializerMethodField()
    image_upload = serializers.ImageField(source='image', write_only=True, required=False, allow_null=True)

    def get_image(self, obj):
        if obj.image:
            return obj.image.url  # relative path: /media/cards/...
        return None

    class Meta:
        model = Card
        fields = ['id', 'session', 'type', 'title', 'content', 'image', 'image_upload',
                  'created_by', 'owner', 'owner_id', 'is_public', 'is_pinned',
                  'pos_x', 'pos_y', 'created_at', 'updated_at']
        read_only_fields = ['session', 'created_by', 'created_at', 'updated_at']


class ThreadSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    card_from_id = serializers.PrimaryKeyRelatedField(
        queryset=Card.objects.all(), source='card_from', write_only=True
    )
    card_to_id = serializers.PrimaryKeyRelatedField(
        queryset=Card.objects.all(), source='card_to', write_only=True
    )

    class Meta:
        model = Thread
        fields = ['id', 'session', 'card_from', 'card_to', 'card_from_id', 'card_to_id',
                  'label', 'created_by']
        read_only_fields = ['session', 'created_by', 'card_from', 'card_to']


class SessionCharacterSerializer(serializers.ModelSerializer):
    character_id = serializers.IntegerField(source='character.id', read_only=True)
    character_name = serializers.CharField(source='character.name', read_only=True)

    class Meta:
        model = SessionCharacter
        fields = ['id', 'character_id', 'character_name']


class NoteSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Note
        fields = ['id', 'session', 'author', 'content', 'is_private', 'created_at', 'updated_at']
        read_only_fields = ['session', 'author', 'created_at', 'updated_at']
