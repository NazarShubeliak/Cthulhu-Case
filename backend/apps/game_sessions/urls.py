from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SessionViewSet, CardViewSet, NoteViewSet

router = DefaultRouter()
router.register(r'', SessionViewSet, basename='session')

urlpatterns = [
    path('', include(router.urls)),
    path('<int:session_pk>/cards/', CardViewSet.as_view({'get': 'list', 'post': 'create'}), name='session-cards'),
    path('<int:session_pk>/cards/<int:pk>/', CardViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='session-card-detail'),
    path('<int:session_pk>/cards/<int:pk>/publish/', CardViewSet.as_view({'post': 'publish'}), name='card-publish'),
    path('<int:session_pk>/notes/', NoteViewSet.as_view({'get': 'list', 'post': 'create'}), name='session-notes'),
    path('<int:session_pk>/notes/<int:pk>/', NoteViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='session-note-detail'),
]
