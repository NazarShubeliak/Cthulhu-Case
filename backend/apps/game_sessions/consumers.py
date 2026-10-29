import json
import time

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.core.cache import cache

User = get_user_model()

# A card being dragged is locked to whoever grabbed it first. The lock lives in
# the cache so a second grab is rejected atomically; the TTL frees cards whose
# holder vanished without a clean disconnect.
CARD_LOCK_TTL = 15
CARD_LOCK_TOUCH_EVERY = 3


def card_lock_key(session_id, card_id):
    return f'card-lock:{session_id}:{card_id}'


class TableConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.group_name = f'session_{self.session_id}'

        # Accept before rejecting: closing an unaccepted socket makes the browser
        # see a bare 1006, while these codes tell the client what went wrong
        # (4001 → refresh the token and retry, 4003 → stop retrying).
        user = await self.get_user_from_token()
        if user is None:
            await self.accept()
            await self.close(code=4001)
            return

        master_id = await self.get_master_id(user)
        if master_id is None:
            await self.accept()
            await self.close(code=4003)
            return

        self.user = user
        self.is_master = master_id == user.id
        self.held_card = None      # the card this socket is dragging
        self.held_ids = set()      # …plus the pins riding along on a map
        self.held_touched = 0
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.channel_layer.group_send(self.group_name, {
            'type': 'player.joined',
            'user_id': user.id,
            'username': user.username,
        })

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            if hasattr(self, 'user'):
                await self.release_card()
                await self.channel_layer.group_send(self.group_name, {
                    'type': 'player.left',
                    'user_id': self.user.id,
                    'username': self.user.username,
                })
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        if not hasattr(self, 'user'):
            return
        try:
            msg = json.loads(text_data)
        except Exception:
            return
        msg_type = msg.get('type')
        if msg_type == 'drawing.stroke':
            await self.channel_layer.group_send(self.group_name, {
                'type': 'drawing.stroke',
                'card_id': msg.get('card_id'),
                'points': msg.get('points', []),
                'sender_id': self.user.id,
            })
        elif msg_type == 'card.grab':
            await self.grab_card(msg.get('card_id'), msg.get('extra_ids') or [])
        elif msg_type == 'card.release':
            if msg.get('card_id') == self.held_card:
                await self.release_card()
        elif msg_type == 'card.moving':
            # Only the lock holder may stream positions — a loser of a grab
            # race keeps sending until it hears it lost, and must not be echoed
            if msg.get('card_id') not in self.held_ids:
                return
            if time.monotonic() - self.held_touched > CARD_LOCK_TOUCH_EVERY:
                self.held_touched = time.monotonic()
                await cache.atouch(card_lock_key(self.session_id, self.held_card), CARD_LOCK_TTL)
            await self.channel_layer.group_send(self.group_name, {
                'type': 'card.moving',
                'card_id': msg.get('card_id'),
                'pos_x': msg.get('pos_x'),
                'pos_y': msg.get('pos_y'),
                'moved_by': self.user.id,
            })
        elif msg_type == 'cursor.ping':
            await self.channel_layer.group_send(self.group_name, {
                'type': 'cursor.ping',
                'x': msg.get('x', 0),
                'y': msg.get('y', 0),
                'user_id': self.user.id,
                'username': self.user.username,
            })

    # ── Drag locks ──

    async def grab_card(self, card_id, extra_ids):
        if not isinstance(card_id, int):
            return
        if not await self.may_drag(card_id):
            return
        if self.held_card is not None and self.held_card != card_id:
            await self.release_card()
        key = card_lock_key(self.session_id, card_id)
        holder = {'user_id': self.user.id, 'username': self.user.username, 'channel': self.channel_name}
        if not await cache.aadd(key, holder, CARD_LOCK_TTL):
            current = await cache.aget(key)
            if current and current['channel'] != self.channel_name:
                await self.send(text_data=json.dumps({
                    'type': 'card.grab_denied',
                    'card_id': card_id,
                    'user_id': current['user_id'],
                    'username': current['username'],
                }))
                return
            await cache.aset(key, holder, CARD_LOCK_TTL)
        self.held_card = card_id
        self.held_ids = {card_id, *(i for i in extra_ids if isinstance(i, int))}
        self.held_touched = time.monotonic()
        await self.channel_layer.group_send(self.group_name, {
            'type': 'card.grabbed',
            'card_id': card_id,
            'user_id': self.user.id,
            'username': self.user.username,
        })

    async def release_card(self):
        card_id = getattr(self, 'held_card', None)
        if card_id is None:
            return
        self.held_card = None
        self.held_ids = set()
        key = card_lock_key(self.session_id, card_id)
        current = await cache.aget(key)
        if current and current['channel'] == self.channel_name:
            await cache.adelete(key)
        await self.channel_layer.group_send(self.group_name, {
            'type': 'card.released',
            'card_id': card_id,
            'user_id': self.user.id,
        })

    # ── Event handlers (type dots → method underscores) ──

    async def card_grabbed(self, event):
        await self.send(text_data=json.dumps({
            'type': 'card.grabbed',
            'card_id': event['card_id'],
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    async def card_released(self, event):
        await self.send(text_data=json.dumps({
            'type': 'card.released',
            'card_id': event['card_id'],
            'user_id': event['user_id'],
        }))

    async def card_moved(self, event):
        await self.send(text_data=json.dumps({
            'type': 'card.moved',
            'card_id': event['card_id'],
            'pos_x': event['pos_x'],
            'pos_y': event['pos_y'],
            'moved_by': event['moved_by'],
        }))

    async def card_moving(self, event):
        await self.send(text_data=json.dumps({
            'type': 'card.moving',
            'card_id': event['card_id'],
            'pos_x': event['pos_x'],
            'pos_y': event['pos_y'],
            'moved_by': event['moved_by'],
        }))

    def can_see_card(self, card):
        """Mirror of CardViewSet.get_queryset: the group gets every card event,
        but a private card must only reach the master and its owner."""
        if card.get('is_public') or self.is_master:
            return True
        owner = card.get('owner') or {}
        return owner.get('id') == self.user.id

    async def card_created(self, event):
        if not self.can_see_card(event['card']):
            return
        await self.send(text_data=json.dumps({'type': 'card.created', 'card': event['card']}))

    async def card_published(self, event):
        await self.send(text_data=json.dumps({'type': 'card.published', 'card': event['card']}))

    async def card_updated(self, event):
        if not self.can_see_card(event['card']):
            return
        await self.send(text_data=json.dumps({'type': 'card.updated', 'card': event['card']}))

    async def card_unpublished(self, event):
        # Off the shared table: whoever can still see it gets the update,
        # everyone else just loses the card
        card = event['card']
        if self.can_see_card(card):
            await self.send(text_data=json.dumps({'type': 'card.updated', 'card': card}))
        else:
            await self.send(text_data=json.dumps({'type': 'card.deleted', 'card_id': card['id']}))

    async def session_settings(self, event):
        await self.send(text_data=json.dumps({
            'type': 'session.settings',
            'table_settings': event['table_settings'],
        }))

    async def card_deleted(self, event):
        await self.send(text_data=json.dumps({'type': 'card.deleted', 'card_id': event['card_id']}))

    async def card_transferred(self, event):
        # The previous owner still needs the event — it tells them to drop the card
        if not self.can_see_card(event['card']) and event['from_user_id'] != self.user.id:
            return
        await self.send(text_data=json.dumps({
            'type': 'card.transferred',
            'card': event['card'],
            'from_user_id': event['from_user_id'],
        }))

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

    async def player_left(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player.left',
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    async def cursor_ping(self, event):
        await self.send(text_data=json.dumps({
            'type': 'cursor.ping',
            'x': event['x'],
            'y': event['y'],
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    async def drawing_stroke(self, event):
        await self.send(text_data=json.dumps({
            'type': 'drawing.stroke',
            'card_id': event['card_id'],
            'points': event['points'],
            'sender_id': event['sender_id'],
        }))

    async def music_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'music.updated',
            'music': event['music'],
            'server_now': event['server_now'],
        }))

    async def dice_rolled(self, event):
        # A hidden roll is for the roller and the master only
        if event.get('visible_to_all') is False and not self.is_master                 and event.get('rolled_by_id') != self.user.id:
            return
        payload = {
            'type': 'dice.rolled',
            'dice_type': event['dice_type'],
            'count': event['count'],
            'results': event['results'],
            'total': event['total'],
            'rolled_by': event['rolled_by'],
        }
        for key in ('roll_id', 'rolled_by_id', 'character_name', 'skill_name', 'tier', 'visible_to_all'):
            if key in event:
                payload[key] = event[key]
        await self.send(text_data=json.dumps(payload))

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
    def may_drag(self, card_id):
        """Players can not move cards on a shared table the master has frozen."""
        if self.is_master:
            return True
        from .models import Card
        card = Card.objects.filter(pk=card_id, session_id=self.session_id).select_related('session').first()
        if card is None:
            return False
        return not (card.is_public and card.session.settings['board_locked'])

    @database_sync_to_async
    def get_master_id(self, user):
        """The session master's id if `user` takes part in the session, else None."""
        from .models import Session
        try:
            session = Session.objects.get(pk=self.session_id)
        except Session.DoesNotExist:
            return None
        return session.master_id if session.is_participant(user) else None
