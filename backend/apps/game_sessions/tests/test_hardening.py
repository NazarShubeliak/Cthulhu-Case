import json
from io import BytesIO

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken

from apps.users.tests.factories import UserFactory
from apps.game_sessions.models import Card, Session
from .factories import SessionFactory, CardFactory


@pytest.mark.django_db
class TestSessionPermissions:
    def test_player_cannot_delete_session(self, api_client):
        session = SessionFactory()
        player = UserFactory()
        session.players.add(player)
        api_client.force_authenticate(user=player)
        res = api_client.delete(f'/api/sessions/{session.id}/')
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert Session.objects.filter(pk=session.id).exists()

    def test_master_can_delete_session(self, api_client):
        session = SessionFactory()
        api_client.force_authenticate(user=session.master)
        res = api_client.delete(f'/api/sessions/{session.id}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT

    def test_player_cannot_rename_session(self, api_client):
        session = SessionFactory(name='Аркгем')
        player = UserFactory()
        session.players.add(player)
        api_client.force_authenticate(user=player)
        res = api_client.patch(f'/api/sessions/{session.id}/', {'name': 'Зламано'})
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_status_is_not_writable_via_patch(self, api_client):
        session = SessionFactory(status='lobby')
        api_client.force_authenticate(user=session.master)
        api_client.patch(f'/api/sessions/{session.id}/', {'status': 'closed'})
        session.refresh_from_db()
        assert session.status == 'lobby'


@pytest.mark.django_db
class TestSetCharacter:
    def test_master_gets_400_not_500(self, api_client):
        session = SessionFactory()
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/set-character/', {'character_id': 1})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_unknown_character_gets_404(self, api_client):
        session = SessionFactory()
        player = UserFactory()
        session.players.add(player)
        api_client.force_authenticate(user=player)
        res = api_client.post(f'/api/sessions/{session.id}/set-character/', {'character_id': 999999})
        assert res.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestBoardNotPaginated:
    def test_all_cards_and_threads_are_returned(self, api_client):
        session = SessionFactory()
        cards = CardFactory.create_batch(60, session=session)
        api_client.force_authenticate(user=session.master)
        for a, b in zip(cards, cards[1:]):
            api_client.post(f'/api/sessions/{session.id}/threads/', {'card_from_id': a.id, 'card_to_id': b.id})

        res = api_client.get(f'/api/sessions/{session.id}/cards/')
        assert isinstance(res.data, list)
        assert len(res.data) == 60
        res = api_client.get(f'/api/sessions/{session.id}/threads/')
        assert len(res.data) == 59


@pytest.mark.django_db
class TestCardRelationsStayInSession:
    def test_owner_must_be_participant(self, api_client):
        session = SessionFactory()
        outsider = UserFactory()
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/cards/', {
            'type': 'document', 'title': 'x', 'owner_id': outsider.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_parent_map_must_be_map_in_same_session(self, api_client):
        session = SessionFactory()
        foreign_map = CardFactory(session=SessionFactory(), type='map')
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/cards/', {
            'type': 'pin', 'parent_map_id': foreign_map.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_thread_cannot_reach_another_session(self, api_client):
        session = SessionFactory()
        own = CardFactory(session=session)
        foreign = CardFactory(session=SessionFactory())
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/threads/', {
            'card_from_id': own.id, 'card_to_id': foreign.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_player_cannot_lock_master_card(self, api_client):
        session = SessionFactory()
        player = UserFactory()
        session.players.add(player)
        card = CardFactory(session=session)
        api_client.force_authenticate(user=player)
        res = api_client.post(f'/api/sessions/{session.id}/cards/{card.id}/pin/')
        assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestRollInput:
    def test_non_numeric_count_is_400(self, api_client):
        session = SessionFactory()
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/roll/', {'dice_type': 'd6', 'count': 'abc'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_roll_carries_roll_id(self, api_client):
        session = SessionFactory()
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/roll/', {'dice_type': 'd6', 'count': 2})
        assert res.status_code == status.HTTP_200_OK
        assert res.data['roll_id']


@pytest.mark.django_db
class TestImageDownscale:
    def _jpeg(self, w, h):
        buf = BytesIO()
        Image.new('RGB', (w, h), (120, 80, 40)).save(buf, 'JPEG')
        return SimpleUploadedFile('big.jpg', buf.getvalue(), content_type='image/jpeg')

    def test_large_upload_is_shrunk(self, api_client, tmp_path, settings):
        settings.MEDIA_ROOT = tmp_path
        session = SessionFactory()
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/cards/', {
            'type': 'photo', 'title': 'Вокзал', 'image_upload': self._jpeg(4000, 3000),
        }, format='multipart')
        assert res.status_code == status.HTTP_201_CREATED
        card = Card.objects.get(pk=res.data['id'])
        with Image.open(card.image.path) as img:
            assert max(img.size) == 2000


@pytest.mark.django_db
class TestAuthThrottle:
    def test_login_is_rate_limited(self, api_client):
        codes = [
            api_client.post('/api/auth/login/', {'username': 'nobody', 'password': 'wrong'}).status_code
            for _ in range(30)
        ]
        assert status.HTTP_400_BAD_REQUEST in codes
        assert codes[-1] == status.HTTP_429_TOO_MANY_REQUESTS


# ── WebSocket consumer ──────────────────────────────────────────────────────

@pytest.fixture
def in_memory_layer(settings):
    from channels.layers import channel_layers
    settings.CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
    channel_layers.backends.clear()
    yield
    channel_layers.backends.clear()


def _application():
    from config.asgi import application
    return application


async def _connect(session_id, user=None, token=None):
    token = token if token is not None else str(AccessToken.for_user(user))
    comm = WebsocketCommunicator(_application(), f'/ws/session/{session_id}/?token={token}')
    connected, _ = await comm.connect()
    return comm, connected


async def _drain(comm):
    """Collect everything already queued for this socket."""
    out = []
    while not await comm.receive_nothing(timeout=0.2):
        out.append(json.loads(await comm.receive_from()))
    return out


def _card(card_id, is_public, owner_id=None):
    return {'id': card_id, 'is_public': is_public, 'owner': {'id': owner_id} if owner_id else None}


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures('in_memory_layer')
class TestConsumer:
    def test_bad_token_closes_with_4001(self):
        session = SessionFactory()

        async def run():
            comm, _ = await _connect(session.id, token='garbage')
            out = await comm.receive_output()
            await comm.disconnect()
            return out

        out = async_to_sync(run)()
        assert out == {'type': 'websocket.close', 'code': 4001}

    def test_non_participant_closes_with_4003(self):
        session = SessionFactory()
        outsider = UserFactory()

        async def run():
            comm, _ = await _connect(session.id, user=outsider)
            out = await comm.receive_output()
            await comm.disconnect()
            return out

        out = async_to_sync(run)()
        assert out == {'type': 'websocket.close', 'code': 4003}

    def test_private_events_reach_only_master_and_owner(self):
        session = SessionFactory()
        owner, other = UserFactory(), UserFactory()
        session.players.add(owner, other)

        async def run():
            socks = {}
            for name, user in (('master', session.master), ('owner', owner), ('other', other)):
                socks[name], connected = await _connect(session.id, user=user)
                assert connected
            for comm in socks.values():
                await _drain(comm)

            layer = get_channel_layer()
            group = f'session_{session.id}'
            await layer.group_send(group, {'type': 'card.created', 'card': _card(1, False, owner.id)})
            await layer.group_send(group, {'type': 'card.updated', 'card': _card(1, False, owner.id)})
            await layer.group_send(group, {
                'type': 'dice.rolled', 'roll_id': 'r1', 'dice_type': 'd100', 'count': 1,
                'results': [42], 'total': 42, 'rolled_by': owner.username,
                'rolled_by_id': owner.id, 'visible_to_all': False,
            })
            await layer.group_send(group, {'type': 'card.created', 'card': _card(2, True)})

            got = {name: [m['type'] for m in await _drain(comm)] for name, comm in socks.items()}
            for comm in socks.values():
                await comm.disconnect()
            return got

        got = async_to_sync(run)()
        assert got['master'] == ['card.created', 'card.updated', 'dice.rolled', 'card.created']
        assert got['owner'] == ['card.created', 'card.updated', 'dice.rolled', 'card.created']
        assert got['other'] == ['card.created']

    def test_transfer_still_reaches_previous_owner(self):
        session = SessionFactory()
        giver, taker, bystander = UserFactory(), UserFactory(), UserFactory()
        session.players.add(giver, taker, bystander)

        async def run():
            socks = {}
            for name, user in (('giver', giver), ('taker', taker), ('bystander', bystander)):
                socks[name], _ = await _connect(session.id, user=user)
            for comm in socks.values():
                await _drain(comm)
            await get_channel_layer().group_send(f'session_{session.id}', {
                'type': 'card.transferred', 'card': _card(5, False, taker.id), 'from_user_id': giver.id,
            })
            got = {name: [m['type'] for m in await _drain(comm)] for name, comm in socks.items()}
            for comm in socks.values():
                await comm.disconnect()
            return got

        got = async_to_sync(run)()
        assert got == {'giver': ['card.transferred'], 'taker': ['card.transferred'], 'bystander': []}
