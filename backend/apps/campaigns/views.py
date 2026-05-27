from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .models import Campaign, Act, Scene, NPC, SceneCard, CampaignAsset
from .serializers import (
    CampaignListSerializer, CampaignSerializer,
    ActListSerializer, ActSerializer,
    SceneListSerializer, SceneSerializer,
    NPCSerializer, SceneCardSerializer, CampaignAssetSerializer,
)

User = get_user_model()


def get_campaign_for_master(campaign_pk, user):
    try:
        campaign = Campaign.objects.get(pk=campaign_pk)
    except Campaign.DoesNotExist:
        raise NotFound('Кампанію не знайдено.')
    if campaign.master != user:
        raise PermissionDenied('Тільки майстер може керувати кампанією.')
    return campaign


def get_act_for_master(campaign_pk, act_pk, user):
    campaign = get_campaign_for_master(campaign_pk, user)
    try:
        return campaign.acts.get(pk=act_pk), campaign
    except Act.DoesNotExist:
        raise NotFound('Акт не знайдено.')


def get_scene_for_master(campaign_pk, act_pk, scene_pk, user):
    act, campaign = get_act_for_master(campaign_pk, act_pk, user)
    try:
        return act.scenes.get(pk=scene_pk), act, campaign
    except Scene.DoesNotExist:
        raise NotFound('Сцену не знайдено.')


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Campaign.objects.filter(master=self.request.user).prefetch_related('acts')

    def get_serializer_class(self):
        if self.action == 'list':
            return CampaignListSerializer
        return CampaignSerializer

    def perform_create(self, serializer):
        serializer.save(master=self.request.user)

    def get_object(self):
        obj = super().get_object()
        if obj.master != self.request.user:
            raise PermissionDenied('Тільки майстер може керувати кампанією.')
        return obj


class ActViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return ActSerializer

    def get_queryset(self):
        campaign = get_campaign_for_master(self.kwargs['campaign_pk'], self.request.user)
        return campaign.acts.prefetch_related('scenes')

    def perform_create(self, serializer):
        campaign = get_campaign_for_master(self.kwargs['campaign_pk'], self.request.user)
        serializer.save(campaign=campaign)


class SceneViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return SceneListSerializer
        return SceneSerializer

    def get_queryset(self):
        act, _ = get_act_for_master(
            self.kwargs['campaign_pk'], self.kwargs['act_pk'], self.request.user
        )
        return act.scenes.prefetch_related('npcs', 'scene_cards__card', 'scene_cards__sent_to')

    def perform_create(self, serializer):
        act, _ = get_act_for_master(
            self.kwargs['campaign_pk'], self.kwargs['act_pk'], self.request.user
        )
        serializer.save(act=act)


class NPCViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NPCSerializer

    def get_queryset(self):
        campaign = get_campaign_for_master(self.kwargs['campaign_pk'], self.request.user)
        return campaign.npcs.prefetch_related('scenes')

    def perform_create(self, serializer):
        campaign = get_campaign_for_master(self.kwargs['campaign_pk'], self.request.user)
        serializer.save(campaign=campaign)


class CampaignAssetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CampaignAssetSerializer

    def get_queryset(self):
        campaign = get_campaign_for_master(self.kwargs['campaign_pk'], self.request.user)
        return campaign.assets.all()

    def perform_create(self, serializer):
        campaign = get_campaign_for_master(self.kwargs['campaign_pk'], self.request.user)
        serializer.save(campaign=campaign)


class SceneCardViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SceneCardSerializer

    def get_queryset(self):
        scene, _, _ = get_scene_for_master(
            self.kwargs['campaign_pk'], self.kwargs['act_pk'],
            self.kwargs['scene_pk'], self.request.user
        )
        return scene.scene_cards.select_related('card', 'sent_to')

    def perform_create(self, serializer):
        scene, _, _ = get_scene_for_master(
            self.kwargs['campaign_pk'], self.kwargs['act_pk'],
            self.kwargs['scene_pk'], self.request.user
        )
        serializer.save(scene=scene)

    @action(detail=True, methods=['post'])
    def send(self, request, campaign_pk=None, act_pk=None, scene_pk=None, pk=None):
        scene_card = self.get_object()
        sent_to_id = request.data.get('sent_to_id')

        if scene_card.is_sent:
            return Response({'error': 'Картку вже відправлено.'}, status=status.HTTP_400_BAD_REQUEST)

        card = scene_card.card
        if sent_to_id:
            try:
                player = User.objects.get(pk=sent_to_id)
            except User.DoesNotExist:
                return Response({'error': 'Гравця не знайдено.'}, status=status.HTTP_404_NOT_FOUND)
            session = card.session
            if not session.players.filter(pk=player.pk).exists():
                return Response({'error': 'Гравець не є учасником цієї сесії.'}, status=status.HTTP_400_BAD_REQUEST)
            card.owner = player
            card.is_public = False
        else:
            card.is_public = True

        card.save()
        scene_card.sent_to_id = sent_to_id
        scene_card.is_sent = True
        scene_card.save()

        return Response(SceneCardSerializer(scene_card, context={'request': request}).data)
