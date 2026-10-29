import pytest
from rest_framework import status

from apps.users.tests.factories import UserFactory
from apps.game_sessions.models import Card, Thread
from .factories import SessionFactory, CardFactory


@pytest.fixture
def table():
    session = SessionFactory()
    alice, bob = UserFactory(), UserFactory()
    session.players.add(alice, bob)
    return session, alice, bob


def _set(session, **settings):
    session.table_settings = settings
    session.save()


def _cards(session):
    return f'/api/sessions/{session.id}/cards/'


@pytest.mark.django_db
class TestSettingsEndpoint:
    def test_defaults_are_exposed(self, api_client, table):
        session, alice, _ = table
        api_client.force_authenticate(alice)
        res = api_client.get(f'/api/sessions/{session.id}/')
        assert res.data['table_settings'] == {
            'players_delete_others': False, 'players_take_cards': True,
            'players_transfer': True, 'board_locked': False,
        }

    def test_master_changes_settings_unknown_keys_ignored(self, api_client, table):
        session, _, _ = table
        api_client.force_authenticate(session.master)
        res = api_client.post(f'/api/sessions/{session.id}/table-settings/',
                              {'board_locked': True, 'hack': True}, format='json')
        assert res.status_code == status.HTTP_200_OK
        session.refresh_from_db()
        assert session.settings['board_locked'] is True
        assert 'hack' not in session.table_settings

    def test_player_cannot_change_settings(self, api_client, table):
        session, alice, _ = table
        api_client.force_authenticate(alice)
        res = api_client.post(f'/api/sessions/{session.id}/table-settings/', {'board_locked': False}, format='json')
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_non_bool_is_400(self, api_client, table):
        session, _, _ = table
        api_client.force_authenticate(session.master)
        res = api_client.post(f'/api/sessions/{session.id}/table-settings/', {'board_locked': 'yes'}, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDeleting:
    def test_players_cannot_delete_others_cards_by_default(self, api_client, table):
        session, alice, bob = table
        card = CardFactory(session=session, created_by=bob)
        api_client.force_authenticate(alice)
        assert api_client.delete(f'{_cards(session)}{card.id}/').status_code == status.HTTP_403_FORBIDDEN

    def test_allowed_when_master_permits(self, api_client, table):
        session, alice, bob = table
        _set(session, players_delete_others=True)
        card = CardFactory(session=session, created_by=bob)
        api_client.force_authenticate(alice)
        assert api_client.delete(f'{_cards(session)}{card.id}/').status_code == status.HTTP_204_NO_CONTENT

    def test_master_cards_never_deletable_by_players(self, api_client, table):
        session, alice, _ = table
        _set(session, players_delete_others=True)
        card = CardFactory(session=session)
        api_client.force_authenticate(alice)
        assert api_client.delete(f'{_cards(session)}{card.id}/').status_code == status.HTTP_403_FORBIDDEN

    def test_own_card_always_deletable(self, api_client, table):
        session, alice, _ = table
        card = CardFactory(session=session, created_by=alice)
        api_client.force_authenticate(alice)
        assert api_client.delete(f'{_cards(session)}{card.id}/').status_code == status.HTTP_204_NO_CONTENT

    def test_others_threads_follow_the_same_rule(self, api_client, table):
        session, alice, bob = table
        a, b = CardFactory(session=session), CardFactory(session=session)
        thread = Thread.objects.create(session=session, card_from=a, card_to=b, created_by=bob)
        api_client.force_authenticate(alice)
        url = f'/api/sessions/{session.id}/threads/{thread.id}/'
        assert api_client.delete(url).status_code == status.HTTP_403_FORBIDDEN
        _set(session, players_delete_others=True)
        assert api_client.delete(url).status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestTakeAndTransfer:
    def test_player_takes_own_card_off_the_table(self, api_client, table):
        session, alice, _ = table
        card = CardFactory(session=session, created_by=alice)
        api_client.force_authenticate(alice)
        res = api_client.post(f'{_cards(session)}{card.id}/take/')
        assert res.status_code == status.HTTP_200_OK
        card.refresh_from_db()
        assert card.is_public is False and card.owner == alice

    def test_player_cannot_take_someone_elses_card(self, api_client, table):
        session, alice, bob = table
        card = CardFactory(session=session, created_by=bob)
        api_client.force_authenticate(alice)
        assert api_client.post(f'{_cards(session)}{card.id}/take/').status_code == status.HTTP_403_FORBIDDEN

    def test_take_can_be_forbidden(self, api_client, table):
        session, alice, _ = table
        _set(session, players_take_cards=False)
        card = CardFactory(session=session, created_by=alice)
        api_client.force_authenticate(alice)
        assert api_client.post(f'{_cards(session)}{card.id}/take/').status_code == status.HTTP_403_FORBIDDEN

    def test_master_takes_any_card_with_its_map_pins(self, api_client, table):
        session, alice, _ = table
        card_map = CardFactory(session=session, type='map', created_by=alice)
        pin = CardFactory(session=session, type='pin', parent_map=card_map, created_by=alice)
        api_client.force_authenticate(session.master)
        assert api_client.post(f'{_cards(session)}{card_map.id}/take/').status_code == status.HTTP_200_OK
        for c in (card_map, pin):
            c.refresh_from_db()
            assert c.is_public is False and c.owner == session.master

    def test_transfer_can_be_forbidden(self, api_client, table):
        session, alice, bob = table
        _set(session, players_transfer=False)
        card = CardFactory(session=session, created_by=alice, owner=alice, is_public=False)
        api_client.force_authenticate(alice)
        res = api_client.post(f'{_cards(session)}{card.id}/transfer/', {'target_user_id': bob.id}, format='json')
        assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestFrozenTable:
    def test_players_cannot_touch_the_shared_table(self, api_client, table):
        session, alice, _ = table
        _set(session, board_locked=True)
        own_public = CardFactory(session=session, created_by=alice)
        other = CardFactory(session=session)
        api_client.force_authenticate(alice)

        assert api_client.patch(f'{_cards(session)}{own_public.id}/', {'pos_x': 5}, format='json').status_code == 403
        assert api_client.post(_cards(session), {'type': 'note', 'title': 'x', 'is_public': True},
                               format='json').status_code == 403
        assert api_client.post(f'/api/sessions/{session.id}/threads/',
                               {'card_from_id': own_public.id, 'card_to_id': other.id},
                               format='json').status_code == 403
        assert api_client.delete(f'{_cards(session)}{own_public.id}/').status_code == 403
        assert Card.objects.filter(pk=own_public.pk).exists()

    def test_personal_space_still_works(self, api_client, table):
        session, alice, _ = table
        _set(session, board_locked=True)
        api_client.force_authenticate(alice)
        res = api_client.post(_cards(session), {'type': 'note', 'title': 'x', 'is_public': False,
                                                'owner_id': alice.id}, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        card = Card.objects.get(pk=res.data['id'])
        assert api_client.patch(f'{_cards(session)}{card.id}/', {'pos_x': 5}, format='json').status_code == 200

    def test_master_is_never_blocked(self, api_client, table):
        session, _, _ = table
        _set(session, board_locked=True)
        card = CardFactory(session=session)
        api_client.force_authenticate(session.master)
        assert api_client.patch(f'{_cards(session)}{card.id}/', {'pos_x': 5}, format='json').status_code == 200
