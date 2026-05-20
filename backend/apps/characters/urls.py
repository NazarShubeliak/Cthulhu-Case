from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CharacterViewSet, SkillViewSet

router = DefaultRouter()
router.register(r'', CharacterViewSet, basename='character')

urlpatterns = [
    path('', include(router.urls)),
    path('<int:character_pk>/skills/<int:pk>/',
         SkillViewSet.as_view({'patch': 'partial_update'}),
         name='character-skill-detail'),
]
