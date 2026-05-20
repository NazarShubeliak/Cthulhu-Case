import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()


class TableConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.group_name = f'session_{self.session_id}'

        user = await self.get_user_from_token()
        if user is None:
            await self.close(code=4001)
            return

        is_participant = await self.check_participant(user)
        if not is_participant:
            await self.close(code=4003)
            return

        self.user = user
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.channel_layer.group_send(self.group_name, {
            'type': 'player.joined',
            'user_id': user.id,
            'username': user.username,
        })

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass

    # ── Event handlers (type dots → method underscores) ──

    async def card_created(self, event):
        await self.send(text_data=json.dumps({'type': 'card.created', 'card': event['card']}))

    async def card_moved(self, event):
        await self.send(text_data=json.dumps({
            'type': 'card.moved',
            'card_id': event['card_id'],
            'pos_x': event['pos_x'],
            'pos_y': event['pos_y'],
            'moved_by': event['moved_by'],
        }))

    async def card_published(self, event):
        await self.send(text_data=json.dumps({'type': 'card.published', 'card': event['card']}))

    async def card_deleted(self, event):
        await self.send(text_data=json.dumps({'type': 'card.deleted', 'card_id': event['card_id']}))

    async def thread_created(self, event):
        await self.send(text_data=json.dumps({'type': 'thread.created', 'thread': event['thread']}))

    async def thread_deleted(self, event):
        await self.send(text_data=json.dumps({'type': 'thread.deleted', 'thread_id': event['thread_id']}))

    async def note_created(self, event):
        await self.send(text_data=json.dumps({'type': 'note.created', 'note': event['note']}))

    async def note_updated(self, event):
        await self.send(text_data=json.dumps({'type': 'note.updated', 'note': event['note']}))

    async def note_deleted(self, event):
        await self.send(text_data=json.dumps({'type': 'note.deleted', 'note_id': event['note_id']}))

    async def player_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player.joined',
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    # ── Helpers ──

    @database_sync_to_async
    def get_user_from_token(self):
        query_string = self.scope.get('query_string', b'').decode()
        params = {}
        for part in query_string.split('&'):
            if '=' in part:
                k, v = part.split('=', 1)
                params[k] = v
        token = params.get('token')
        if not token:
            return None
        try:
            access_token = AccessToken(token)
            return User.objects.get(id=access_token['user_id'])
        except Exception:
            return None

    @database_sync_to_async
    def check_participant(self, user):
        from .models import Session
        try:
            session = Session.objects.get(pk=self.session_id)
            return session.is_participant(user)
        except Session.DoesNotExist:
            return False
