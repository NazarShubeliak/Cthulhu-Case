from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CampaignViewSet, ActViewSet, SceneViewSet, NPCViewSet, SceneCardViewSet, CampaignAssetViewSet

router = DefaultRouter()
router.register(r'', CampaignViewSet, basename='campaign')

urlpatterns = [
    path('', include(router.urls)),

    # Acts
    path('<int:campaign_pk>/acts/',
         ActViewSet.as_view({'get': 'list', 'post': 'create'}), name='campaign-acts'),
    path('<int:campaign_pk>/acts/<int:pk>/',
         ActViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='campaign-act-detail'),

    # Scenes
    path('<int:campaign_pk>/acts/<int:act_pk>/scenes/',
         SceneViewSet.as_view({'get': 'list', 'post': 'create'}), name='act-scenes'),
    path('<int:campaign_pk>/acts/<int:act_pk>/scenes/<int:pk>/',
         SceneViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='act-scene-detail'),

    # Scene cards
    path('<int:campaign_pk>/acts/<int:act_pk>/scenes/<int:scene_pk>/cards/',
         SceneCardViewSet.as_view({'get': 'list', 'post': 'create'}), name='scene-cards'),
    path('<int:campaign_pk>/acts/<int:act_pk>/scenes/<int:scene_pk>/cards/<int:pk>/',
         SceneCardViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}), name='scene-card-detail'),
    path('<int:campaign_pk>/acts/<int:act_pk>/scenes/<int:scene_pk>/cards/<int:pk>/send/',
         SceneCardViewSet.as_view({'post': 'send'}), name='scene-card-send'),

    # NPCs
    path('<int:campaign_pk>/npcs/',
         NPCViewSet.as_view({'get': 'list', 'post': 'create'}), name='campaign-npcs'),
    path('<int:campaign_pk>/npcs/<int:pk>/',
         NPCViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='campaign-npc-detail'),

    # Assets
    path('<int:campaign_pk>/assets/',
         CampaignAssetViewSet.as_view({'get': 'list', 'post': 'create'}), name='campaign-assets'),
    path('<int:campaign_pk>/assets/<int:pk>/',
         CampaignAssetViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='campaign-asset-detail'),
]
