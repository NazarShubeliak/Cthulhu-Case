from django.urls import re_path
from apps.game_sessions.consumers import TableConsumer

websocket_urlpatterns = [
    re_path(r'ws/session/(?P<session_id>\d+)/$', TableConsumer.as_asgi()),
]
