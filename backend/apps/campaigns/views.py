from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated

from .models import Campaign, Act
from .serializers import (
    CampaignListSerializer, CampaignSerializer,
    ActSerializer,
    SceneListSerializer, SceneSerializer,
    NPCSerializer, CampaignAssetSerializer,
)


def get_campaign_for_master(campaign_pk, user):
    try:
        campaign = Campaign.objects.get(pk=campaign_pk)
    except Campaign.DoesNotExist:
        raise NotFound(_('Кампанію не знайдено.'))
    if campaign.master != user:
        raise PermissionDenied(_('Тільки майстер може керувати кампанією.'))
    return campaign


def get_act_for_master(campaign_pk, act_pk, user):
    campaign = get_campaign_for_master(campaign_pk, user)
    try:
        return campaign.acts.get(pk=act_pk), campaign
    except Act.DoesNotExist:
        raise NotFound(_('Акт не знайдено.'))


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
            raise PermissionDenied(_('Тільки майстер може керувати кампанією.'))
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
        return act.scenes.all()

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
        return campaign.npcs.all()

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
