from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from django.contrib.auth import get_user_model

from .models import Session, Card, Note
from .serializers import (
    SessionListSerializer, SessionDetailSerializer, SessionCreateSerializer,
    CardSerializer, NoteSerializer,
)

User = get_user_model()


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

    def perform_create(self, serializer):
        serializer.save(master=self.request.user)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        session = self.get_object()
        if session.status == 'closed':
            return Response({'error': 'Сесія закрита.'}, status=status.HTTP_400_BAD_REQUEST)
        if session.master == request.user:
            return Response({'error': 'Ви майстер цієї сесії.'}, status=status.HTTP_400_BAD_REQUEST)
        session.players.add(request.user)
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
        # Players: see public cards + their own private cards
        return Card.objects.filter(
            Q(session=session, is_public=True) |
            Q(session=session, owner=user)
        ).select_related('created_by', 'owner')

    def perform_create(self, serializer):
        session = self.get_session()
        serializer.save(session=session, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def publish(self, request, session_pk=None, pk=None):
        card = self.get_object()
        session = self.get_session()
        # Only master or card owner can publish
        if request.user != session.master and request.user != card.owner:
            return Response({'error': 'Недостатньо прав.'}, status=status.HTTP_403_FORBIDDEN)
        card.is_public = True
        card.save()
        return Response(CardSerializer(card, context={'request': request}).data)


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
        # See public notes + own private notes (master does NOT see private player notes)
        return Note.objects.filter(
            Q(session=session, is_private=False) |
            Q(session=session, is_private=True, author=user)
        ).select_related('author')

    def perform_create(self, serializer):
        session = self.get_session()
        serializer.save(session=session, author=self.request.user)

    def update(self, request, *args, **kwargs):
        note = self.get_object()
        if note.author != request.user:
            return Response({'error': 'Ви не автор цієї нотатки.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        note = self.get_object()
        if note.author != request.user:
            return Response({'error': 'Ви не автор цієї нотатки.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
