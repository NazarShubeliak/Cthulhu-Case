import pytest
from rest_framework import status

from apps.users.tests.factories import UserFactory
from .factories import SessionFactory


def _url(session):
    return f'/api/sessions/{session.id}/music/'


TRACKS = [{'videoId': 'dQw4w9WgXcQ', 'title': 'Track A'}, {'videoId': 'abcdefghijk', 'title': 'Track B'}]


@pytest.mark.django_db
class TestSessionMusic:
    def test_master_sets_state_and_players_read_it(self, api_client):
        session = SessionFactory()
        player = UserFactory()
        session.players.add(player)

        api_client.force_authenticate(session.master)
        res = api_client.post(_url(session), {
            'tracks': TRACKS, 'current': 'abcdefghijk', 'playing': True, 'offset': 12.5,
        }, format='json')
        assert res.status_code == status.HTTP_200_OK

        api_client.force_authenticate(player)
        res = api_client.get(_url(session))
        assert res.status_code == status.HTTP_200_OK
        music = res.data['music']
        assert [t['videoId'] for t in music['tracks']] == ['dQw4w9WgXcQ', 'abcdefghijk']
        assert music['current'] == 'abcdefghijk'
        assert music['playing'] is True
        assert music['offset'] == 12.5
        assert res.data['server_now'] >= music['updated_at']

    def test_player_cannot_change_music(self, api_client):
        session = SessionFactory()
        player = UserFactory()
        session.players.add(player)
        api_client.force_authenticate(player)
        res = api_client.post(_url(session), {'tracks': TRACKS, 'current': None}, format='json')
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_outsider_cannot_read_music(self, api_client):
        session = SessionFactory()
        api_client.force_authenticate(UserFactory())
        assert api_client.get(_url(session)).status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.parametrize('body', [
        {'tracks': [{'videoId': 'not a valid id!'}]},
        {'tracks': TRACKS, 'current': 'zzzzzzzzzzz'},
        {'tracks': 'nope'},
        {'tracks': TRACKS, 'offset': 'soon'},
    ])
    def test_invalid_state_is_400(self, api_client, body):
        session = SessionFactory()
        api_client.force_authenticate(session.master)
        assert api_client.post(_url(session), body, format='json').status_code == status.HTTP_400_BAD_REQUEST

    def test_nothing_playing_without_a_current_track(self, api_client):
        session = SessionFactory()
        api_client.force_authenticate(session.master)
        res = api_client.post(_url(session), {'tracks': TRACKS, 'current': None, 'playing': True}, format='json')
        assert res.data['music']['playing'] is False
