import pytest
from unittest.mock import patch, MagicMock
from rest_framework import status

from apps.users.tests.factories import UserFactory, MasterFactory
from .factories import SessionFactory, CardFactory, NoteFactory


@pytest.mark.django_db
class TestSessionCreate:
    url = '/api/sessions/'

    def test_master_can_create(self, api_client, db):
        master = MasterFactory()
        api_client.force_authenticate(user=master)
        res = api_client.post(self.url, {'name': 'Аркгем 1923'})
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['status'] == 'lobby'
        assert 'join_code' in res.data
        assert len(res.data['join_code']) == 6

    def test_any_authenticated_user_can_create(self, api_client, db):
        player = UserFactory(role='player')
        api_client.force_authenticate(user=player)
        res = api_client.post(self.url, {'name': 'Гра'})
        assert res.status_code == status.HTTP_201_CREATED

    def test_unauthenticated_denied(self, api_client):
        res = api_client.post(self.url, {'name': 'Гра'})
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestSessionJoin:
    def test_join_by_code(self, api_client, db):
        session = SessionFactory(status='lobby')
        player = UserFactory()
        api_client.force_authenticate(user=player)
        res = api_client.post('/api/sessions/join-by-code/', {'code': session.join_code})
        assert res.status_code == status.HTTP_200_OK
        session.refresh_from_db()
        assert session.players.filter(pk=player.pk).exists()

    def test_invalid_code(self, api_client, db):
        player = UserFactory()
        api_client.force_authenticate(user=player)
        res = api_client.post('/api/sessions/join-by-code/', {'code': 'ZZZZZZ'})
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_master_can_start_session(self, api_client, db):
        session = SessionFactory(status='lobby')
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/start/')
        assert res.status_code == status.HTTP_200_OK
        session.refresh_from_db()
        assert session.status == 'active'

    def test_player_cannot_start_session(self, api_client, db):
        player = UserFactory()
        session = SessionFactory(status='lobby')
        session.players.add(player)
        api_client.force_authenticate(user=player)
        res = api_client.post(f'/api/sessions/{session.id}/start/')
        assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestSessionList:
    url = '/api/sessions/'

    def test_shows_own_sessions(self, api_client, db):
        master = MasterFactory()
        player = UserFactory()
        s1 = SessionFactory(master=master)
        s2 = SessionFactory()
        s2.players.add(player)

        api_client.force_authenticate(user=master)
        res = api_client.get(self.url)
        sessions = res.data.get('results', res.data)
        ids = [s['id'] for s in sessions]
        assert s1.id in ids
        assert s2.id not in ids

    def test_player_sees_joined_sessions(self, api_client, db):
        player = UserFactory()
        session = SessionFactory()
        session.players.add(player)
        api_client.force_authenticate(user=player)
        res = api_client.get(self.url)
        sessions = res.data.get('results', res.data)
        assert any(s['id'] == session.id for s in sessions)


@pytest.mark.django_db
class TestCards:
    def test_master_can_create_card(self, api_client, db):
        session = SessionFactory(status='active')
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/cards/', {
            'title': 'Лист з готелю',
            'type': 'document',
            'content': 'Таємниче повідомлення...',
        })
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['is_public'] is False  # нова картка — приватна за замовчуванням

    def test_publish_card(self, api_client, db):
        session = SessionFactory(status='active')
        card = CardFactory(session=session, created_by=session.master, is_public=False)
        api_client.force_authenticate(user=session.master)
        res = api_client.post(f'/api/sessions/{session.id}/cards/{card.id}/publish/')
        assert res.status_code == status.HTTP_200_OK
        card.refresh_from_db()
        assert card.is_public is True

    def test_player_sees_only_public_cards(self, api_client, db):
        player = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player)
        CardFactory(session=session, created_by=session.master, is_public=True)
        CardFactory(session=session, created_by=session.master, is_public=False)

        api_client.force_authenticate(user=player)
        res = api_client.get(f'/api/sessions/{session.id}/cards/')
        assert res.status_code == status.HTTP_200_OK
        cards = res.data.get('results', res.data)
        # Гравець бачить тільки публічні картки
        assert all(c['is_public'] for c in cards)

    def test_non_participant_cannot_see_cards(self, api_client, db):
        outsider = UserFactory()
        session = SessionFactory(status='active')
        CardFactory(session=session, is_public=True)
        api_client.force_authenticate(user=outsider)
        res = api_client.get(f'/api/sessions/{session.id}/cards/')
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_move_card(self, api_client, db):
        session = SessionFactory(status='active')
        card = CardFactory(session=session, is_public=True, pos_x=0, pos_y=0)
        api_client.force_authenticate(user=session.master)
        res = api_client.patch(f'/api/sessions/{session.id}/cards/{card.id}/', {
            'pos_x': 350.5,
            'pos_y': 200.0,
        })
        assert res.status_code == status.HTTP_200_OK
        card.refresh_from_db()
        assert card.pos_x == pytest.approx(350.5)
        assert card.pos_y == pytest.approx(200.0)

    def test_delete_card(self, api_client, db):
        session = SessionFactory(status='active')
        card = CardFactory(session=session, created_by=session.master)
        api_client.force_authenticate(user=session.master)
        res = api_client.delete(f'/api/sessions/{session.id}/cards/{card.id}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestNotes:
    def test_create_public_note(self, api_client, db):
        player = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player)
        api_client.force_authenticate(user=player)
        res = api_client.post(f'/api/sessions/{session.id}/notes/', {
            'content': 'Потрібно перевірити бібліотеку',
            'is_private': False,
        })
        assert res.status_code == status.HTTP_201_CREATED

    def test_private_note_hidden_from_others(self, api_client, db):
        player1 = UserFactory()
        player2 = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player1, player2)
        NoteFactory(session=session, author=player1, is_private=True)

        api_client.force_authenticate(user=player2)
        res = api_client.get(f'/api/sessions/{session.id}/notes/')
        assert res.status_code == status.HTTP_200_OK
        notes = res.data.get('results', res.data)
        assert all(n['author']['id'] != player1.id or not n['is_private'] for n in notes)

    def test_author_sees_own_private_note(self, api_client, db):
        player = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player)
        note = NoteFactory(session=session, author=player, is_private=True)

        api_client.force_authenticate(user=player)
        res = api_client.get(f'/api/sessions/{session.id}/notes/')
        notes = res.data.get('results', res.data)
        assert any(n['id'] == note.id for n in notes)


@pytest.mark.django_db
class TestCardTransfer:
    def _url(self, session_id, card_id):
        return f'/api/sessions/{session_id}/cards/{card_id}/transfer/'

    def test_owner_can_transfer_personal_card(self, api_client, db):
        player1 = UserFactory()
        player2 = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player1, player2)
        card = CardFactory(session=session, created_by=session.master, owner=player1, is_public=False)

        api_client.force_authenticate(user=player1)
        res = api_client.post(self._url(session.id, card.id), {'target_user_id': player2.id})

        assert res.status_code == status.HTTP_200_OK
        card.refresh_from_db()
        assert card.owner == player2

    def test_sender_loses_card_receiver_gains_it(self, api_client, db):
        player1 = UserFactory()
        player2 = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player1, player2)
        card = CardFactory(session=session, created_by=session.master, owner=player1, is_public=False)

        api_client.force_authenticate(user=player1)
        api_client.post(self._url(session.id, card.id), {'target_user_id': player2.id})

        # player1 більше не бачить картку
        res1 = api_client.get(f'/api/sessions/{session.id}/cards/')
        cards1 = res1.data.get('results', res1.data)
        assert not any(c['id'] == card.id for c in cards1)

        # player2 тепер бачить картку
        api_client.force_authenticate(user=player2)
        res2 = api_client.get(f'/api/sessions/{session.id}/cards/')
        cards2 = res2.data.get('results', res2.data)
        assert any(c['id'] == card.id for c in cards2)

    def test_cannot_transfer_public_card(self, api_client, db):
        player = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player)
        card = CardFactory(session=session, created_by=session.master, is_public=True)

        api_client.force_authenticate(user=session.master)
        res = api_client.post(self._url(session.id, card.id), {'target_user_id': player.id})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_transfer_others_card(self, api_client, db):
        player1 = UserFactory()
        player2 = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player1, player2)
        card = CardFactory(session=session, created_by=session.master, owner=player1, is_public=False)

        # player2 не є власником — картка взагалі не входить в його queryset → 404
        api_client.force_authenticate(user=player2)
        res = api_client.post(self._url(session.id, card.id), {'target_user_id': player2.id})
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_transfer_to_non_participant(self, api_client, db):
        player = UserFactory()
        outsider = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player)
        card = CardFactory(session=session, created_by=session.master, owner=player, is_public=False)

        api_client.force_authenticate(user=player)
        res = api_client.post(self._url(session.id, card.id), {'target_user_id': outsider.id})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_master_can_transfer_any_personal_card(self, api_client, db):
        player1 = UserFactory()
        player2 = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player1, player2)
        card = CardFactory(session=session, created_by=session.master, owner=player1, is_public=False)

        api_client.force_authenticate(user=session.master)
        res = api_client.post(self._url(session.id, card.id), {'target_user_id': player2.id})
        assert res.status_code == status.HTTP_200_OK
        card.refresh_from_db()
        assert card.owner == player2

    def test_transfer_broadcasts_ws_event(self, api_client, db):
        player1 = UserFactory()
        player2 = UserFactory()
        session = SessionFactory(status='active')
        session.players.add(player1, player2)
        card = CardFactory(session=session, created_by=session.master, owner=player1, is_public=False)

        mock_layer = MagicMock()
        with patch('apps.game_sessions.views.get_channel_layer', return_value=mock_layer):
            with patch('apps.game_sessions.views.async_to_sync') as mock_sync:
                api_client.force_authenticate(user=player1)
                api_client.post(self._url(session.id, card.id), {'target_user_id': player2.id})

        # broadcast мав бути викликаний
        mock_sync.assert_called()
        call_args = mock_sync.call_args_list
        # перевіряємо що викликали group_send
        assert any('group_send' in str(c) for c in call_args)
