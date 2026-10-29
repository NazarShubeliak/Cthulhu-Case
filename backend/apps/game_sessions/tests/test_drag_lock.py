import json

import pytest
from asgiref.sync import async_to_sync

from apps.users.tests.factories import UserFactory
from .factories import SessionFactory, CardFactory
from .test_hardening import _connect, _drain, in_memory_layer  # noqa: F401


def _types(msgs):
    return [m['type'] for m in msgs]


def _grab(card_id, **extra):
    return json.dumps({'type': 'card.grab', 'card_id': card_id, **extra})


def _move(card_id, x=1, y=1):
    return json.dumps({'type': 'card.moving', 'card_id': card_id, 'pos_x': x, 'pos_y': y})


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures('in_memory_layer')
class TestDragLock:
    def _session(self):
        session = SessionFactory()
        alice, bob = UserFactory(), UserFactory()
        session.players.add(alice, bob)
        return session, alice, bob

    def test_second_grab_is_denied_and_its_moves_dropped(self):
        session, alice, bob = self._session()
        card = CardFactory(session=session)

        async def run():
            a, _ = await _connect(session.id, user=alice)
            b, _ = await _connect(session.id, user=bob)
            await _drain(a)
            await _drain(b)

            await a.send_to(text_data=_grab(card.id))
            await _drain(a)
            await _drain(b)

            await b.send_to(text_data=_grab(card.id))
            await b.send_to(text_data=_move(card.id))
            got_b = await _drain(b)
            got_a = await _drain(a)
            await a.disconnect()
            await b.disconnect()
            return got_a, got_b

        got_a, got_b = async_to_sync(run)()
        assert _types(got_b) == ['card.grab_denied']
        assert got_b[0]['username'] == alice.username
        assert got_a == []  # bob's moves never reach anyone

    def test_holder_moves_are_broadcast_with_map_pins(self):
        session, alice, bob = self._session()
        card_map = CardFactory(session=session, type='map')
        pin = CardFactory(session=session, type='pin', parent_map=card_map)
        other = CardFactory(session=session)

        async def run():
            a, _ = await _connect(session.id, user=alice)
            b, _ = await _connect(session.id, user=bob)
            await _drain(a)
            await _drain(b)
            await a.send_to(text_data=_grab(card_map.id, extra_ids=[pin.id]))
            await a.send_to(text_data=_move(card_map.id, 5, 6))
            await a.send_to(text_data=_move(pin.id, 9, 9))
            await a.send_to(text_data=_move(other.id, 0, 0))
            got = await _drain(b)
            await a.disconnect()
            await b.disconnect()
            return got

        got = async_to_sync(run)()
        assert _types(got) == ['card.grabbed', 'card.moving', 'card.moving']
        assert [m['card_id'] for m in got[1:]] == [card_map.id, pin.id]

    def test_release_and_disconnect_free_the_card(self):
        session, alice, bob = self._session()
        card = CardFactory(session=session)

        async def run():
            a, _ = await _connect(session.id, user=alice)
            b, _ = await _connect(session.id, user=bob)
            await _drain(a)
            await _drain(b)

            await a.send_to(text_data=_grab(card.id))
            await a.send_to(text_data=json.dumps({'type': 'card.release', 'card_id': card.id}))
            await _drain(a)
            released = _types(await _drain(b))

            await b.send_to(text_data=_grab(card.id))
            after_release = _types(await _drain(b))

            await b.disconnect()  # holder vanishes mid-drag
            await a.send_to(text_data=_grab(card.id))
            after_disconnect = _types(await _drain(a))
            await a.disconnect()
            return released, after_release, after_disconnect

        released, after_release, after_disconnect = async_to_sync(run)()
        assert released == ['card.grabbed', 'card.released']
        assert after_release == ['card.grabbed']
        assert 'card.grabbed' in after_disconnect and 'card.grab_denied' not in after_disconnect

    def test_frozen_table_cannot_be_dragged_by_players(self):
        session, alice, _ = self._session()
        session.table_settings = {'board_locked': True}
        session.save()
        public = CardFactory(session=session)
        personal = CardFactory(session=session, is_public=False, owner=alice, created_by=alice)

        async def run():
            a, _ = await _connect(session.id, user=alice)
            m, _ = await _connect(session.id, user=session.master)
            await _drain(a)
            await _drain(m)
            await a.send_to(text_data=_grab(public.id))
            frozen = _types(await _drain(m))
            await a.send_to(text_data=_grab(personal.id))
            own = _types(await _drain(m))
            await _drain(a)
            await m.send_to(text_data=_grab(public.id))
            master = _types(await _drain(a))
            await a.disconnect()
            await m.disconnect()
            return frozen, own, master

        frozen, own, master = async_to_sync(run)()
        assert frozen == []
        assert own == ['card.grabbed']
        assert master == ['card.grabbed']
