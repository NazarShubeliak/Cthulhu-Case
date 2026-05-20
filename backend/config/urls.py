from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/characters/', include('apps.characters.urls')),
    path('api/sessions/', include('apps.game_sessions.urls')),
    path('api/campaigns/', include('apps.campaigns.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
