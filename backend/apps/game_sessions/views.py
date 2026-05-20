from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from django.contrib.auth import get_user_model

from .models import Session, Card, Note, Thread
from .serializers import (
    SessionListSerializer, SessionDetailSerializer, SessionCreateSerializer,
    CardSerializer, NoteSerializer, ThreadSerializer,
)

User = get_user_model()


def broadcast(session_id, message):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(f'session_{session_id}', message)


class SessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Session.objects.filter(
            Q(master=user) | Q(players=user) | Q(status='lobby')
        ).distinct().prefetch_related('players').select_related('master')

    def get_serializer_class(self):
        if self.action == 'create':
            return SessionCreateSerializer
        if self.action == 'list':
            return SessionListSerializer
        return SessionDetailSerializer

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
        session = self.get_object()
        if session.status == 'closed':
            return Response({'error': 'Сесія закрита.'}, status=status.HTTP_400_BAD_REQUEST)
        if session.master == request.user:
            return Response({'error': 'Ви майстер цієї сесії.'}, status=status.HTTP_400_BAD_REQUEST)
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
            return Response({'error': 'Майстер не може покинути сесію.'}, status=status.HTTP_400_BAD_REQUEST)
        session.players.remove(request.user)
        return Response({'status': 'left'})

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        session = self.get_object()
        if session.master != request.user:
            return Response({'error': 'Тільки майстер може розпочати сесію.'}, status=status.HTTP_403_FORBIDDEN)
        session.status = 'active'
        session.save()
        return Response(SessionDetailSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        session = self.get_object()
        if session.master != request.user:
            return Response({'error': 'Тільки майстер може закрити сесію.'}, status=status.HTTP_403_FORBIDDEN)
        session.status = 'closed'
        session.save()
        return Response(SessionDetailSerializer(session, context={'request': request}).data)


class CardViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CardSerializer

    def get_session(self):
        session_pk = self.kwargs['session_pk']
        user = self.request.user
        try:
            session = Session.objects.get(pk=session_pk)
        except Session.DoesNotExist:
            raise NotFound('Сесію не знайдено.')
        if not session.is_participant(user):
            raise PermissionDenied('Ви не учасник цієї сесії.')
        return session

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
        card = serializer.save(session=session, created_by=self.request.user)
        if card.is_public:
            broadcast(session.id, {
                'type': 'card.created',
                'card': CardSerializer(card, context={'request': self.request}).data,
            })

    def perform_update(self, serializer):
        session = self.get_session()
        if (serializer.instance.created_by != self.request.user
                and session.master != self.request.user):
            raise PermissionDenied('Недостатньо прав для редагування цієї картки.')
        card = serializer.save()
        broadcast(session.id, {
            'type': 'card.moved',
            'card_id': card.id,
            'pos_x': card.pos_x,
            'pos_y': card.pos_y,
            'moved_by': self.request.user.id,
        })

    def perform_destroy(self, instance):
        session = self.get_session()
        if (instance.created_by != self.request.user
                and session.master != self.request.user):
            raise PermissionDenied('Недостатньо прав для видалення цієї картки.')
        session_id = instance.session_id
        card_id = instance.id
        instance.delete()
        broadcast(session_id, {'type': 'card.deleted', 'card_id': card_id})

    @action(detail=True, methods=['post'])
    def publish(self, request, session_pk=None, pk=None):
        card = self.get_object()
        session = self.get_session()
        if request.user != session.master and request.user != card.owner:
            return Response({'error': 'Недостатньо прав.'}, status=status.HTTP_403_FORBIDDEN)
        card.is_public = True
        card.save()
        data = CardSerializer(card, context={'request': request}).data
        broadcast(session.id, {'type': 'card.published', 'card': data})
        return Response(data)


class ThreadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ThreadSerializer

    def get_session(self):
        session_pk = self.kwargs['session_pk']
        user = self.request.user
        try:
            session = Session.objects.get(pk=session_pk)
        except Session.DoesNotExist:
            raise NotFound('Сесію не знайдено.')
        if not session.is_participant(user):
            raise PermissionDenied('Ви не учасник цієї сесії.')
        return session

    def get_queryset(self):
        session = self.get_session()
        return Thread.objects.filter(session=session).select_related('created_by', 'card_from', 'card_to')

    def perform_create(self, serializer):
        from django.db import IntegrityError
        session = self.get_session()
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
        if (instance.created_by != self.request.user
                and session.master != self.request.user):
            raise PermissionDenied('Недостатньо прав для видалення цієї нитки.')
        session_id = instance.session_id
        thread_id = instance.id
        instance.delete()
        broadcast(session_id, {'type': 'thread.deleted', 'thread_id': thread_id})


class NoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NoteSerializer

    def get_session(self):
        session_pk = self.kwargs['session_pk']
        user = self.request.user
        try:
            session = Session.objects.get(pk=session_pk)
        except Session.DoesNotExist:
            raise NotFound('Сесію не знайдено.')
        if not session.is_participant(user):
            raise PermissionDenied('Ви не учасник цієї сесії.')
        return session

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
            return Response({'error': 'Ви не автор цієї нотатки.'}, status=status.HTTP_403_FORBIDDEN)
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
            return Response({'error': 'Ви не автор цієї нотатки.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        session_id = instance.session_id
        note_id = instance.id
        is_public = not instance.is_private
        instance.delete()
        if is_public:
            broadcast(session_id, {'type': 'note.deleted', 'note_id': note_id})
