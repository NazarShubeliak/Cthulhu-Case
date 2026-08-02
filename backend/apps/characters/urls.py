from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CharacterViewSet, SkillViewSet, EquipmentViewSet, MentalScarViewSet

router = DefaultRouter()
router.register(r'', CharacterViewSet, basename='character')

urlpatterns = [
    path('', include(router.urls)),
    path('<int:character_pk>/skills/',
         SkillViewSet.as_view({'post': 'create'}),
         name='character-skill-list'),
    path('<int:character_pk>/skills/<int:pk>/',
         SkillViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'}),
         name='character-skill-detail'),
    path('<int:character_pk>/equipment/',
         EquipmentViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='character-equipment-list'),
    path('<int:character_pk>/equipment/<int:pk>/',
         EquipmentViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'}),
         name='character-equipment-detail'),
    path('<int:character_pk>/mental-scars/',
         MentalScarViewSet.as_view({'post': 'create'}),
         name='character-mental-scars-list'),
    path('<int:character_pk>/mental-scars/<int:pk>/',
         MentalScarViewSet.as_view({'delete': 'destroy'}),
         name='character-mental-scars-detail'),
]
