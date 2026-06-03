import pytest
from rest_framework import status

from apps.users.tests.factories import UserFactory
from .factories import CharacterFactory, SkillFactory


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def client_for(user, api_client):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.mark.django_db
class TestCharacterCRUD:
    url = '/api/characters/'

    def test_list_own_only(self, api_client, db):
        owner = UserFactory()
        other = UserFactory()
        CharacterFactory(user=owner)
        CharacterFactory(user=other)
        api_client.force_authenticate(user=owner)
        res = api_client.get(self.url)
        assert res.status_code == status.HTTP_200_OK
        items = res.data.get('results', res.data)
        assert len(items) == 1

    def test_create_calculates_derived_stats(self, api_client, db):
        user = UserFactory()
        api_client.force_authenticate(user=user)
        data = {
            'name': 'Генрі Арм',
            'con_stat': 60,
            'siz_stat': 60,
            'pow_stat': 50,
        }
        res = api_client.post(self.url, data)
        assert res.status_code == status.HTTP_201_CREATED
        # HP = (CON + SIZ) // 10 = 12
        assert res.data['hp_max'] == 12
        assert res.data['hp_current'] == 12
        # MP = POW // 5 = 10
        assert res.data['mp_max'] == 10
        # Sanity initial = POW
        assert res.data['sanity_current'] == 50

    def test_create_generates_default_skills(self, api_client, db):
        user = UserFactory()
        api_client.force_authenticate(user=user)
        res = api_client.post(self.url, {'name': 'Тест'})
        assert res.status_code == status.HTTP_201_CREATED
        char_id = res.data['id']
        res2 = api_client.get(f'{self.url}{char_id}/')
        assert len(res2.data['skills']) == 20

    def test_unauthenticated_denied(self, api_client):
        res = api_client.get(self.url)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_own(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        api_client.force_authenticate(user=user)
        res = api_client.delete(f'{self.url}{char.id}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT

    def test_cannot_access_others_character(self, api_client, db):
        owner = UserFactory()
        other = UserFactory()
        char = CharacterFactory(user=owner)
        api_client.force_authenticate(user=other)
        res = api_client.get(f'{self.url}{char.id}/')
        assert res.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestDerivedStatsRecalculation:
    def test_patch_con_updates_hp(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user, con_stat=50, siz_stat=50, hp_max=10, hp_current=10)
        api_client.force_authenticate(user=user)
        res = api_client.patch(f'/api/characters/{char.id}/', {'con_stat': 80}, format='json')
        assert res.status_code == status.HTTP_200_OK
        # HP = (80 + 50) // 10 = 13
        assert res.data['hp_max'] == 13

    def test_patch_pow_updates_mp(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user, pow_stat=50, mp_max=10, mp_current=10)
        api_client.force_authenticate(user=user)
        res = api_client.patch(f'/api/characters/{char.id}/', {'pow_stat': 70}, format='json')
        assert res.status_code == status.HTTP_200_OK
        # MP = 70 // 5 = 14
        assert res.data['mp_max'] == 14

    def test_hp_capped_on_decrease(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user, con_stat=80, siz_stat=80, hp_max=16, hp_current=16)
        api_client.force_authenticate(user=user)
        res = api_client.patch(f'/api/characters/{char.id}/', {'con_stat': 20, 'siz_stat': 20}, format='json')
        assert res.status_code == status.HTTP_200_OK
        # HP max = (20+20)//10 = 4, current must be capped at 4
        assert res.data['hp_max'] == 4
        assert res.data['hp_current'] <= 4


@pytest.mark.django_db
class TestDiceRoll:
    def test_d100_roll_returns_result(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        api_client.force_authenticate(user=user)
        res = api_client.post(f'/api/characters/{char.id}/roll/', {'dice_type': 'd100', 'dice_count': 1})
        assert res.status_code == status.HTTP_201_CREATED
        assert len(res.data['results']) == 1
        assert 1 <= res.data['total'] <= 100

    def test_d6_multiple_dice(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        api_client.force_authenticate(user=user)
        res = api_client.post(f'/api/characters/{char.id}/roll/', {'dice_type': 'd6', 'dice_count': 3})
        assert res.status_code == status.HTTP_201_CREATED
        assert len(res.data['results']) == 3
        assert all(1 <= r <= 6 for r in res.data['results'])

    def test_invalid_dice_type(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        api_client.force_authenticate(user=user)
        res = api_client.post(f'/api/characters/{char.id}/roll/', {'dice_type': 'd999'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_too_many_dice(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        api_client.force_authenticate(user=user)
        res = api_client.post(f'/api/characters/{char.id}/roll/', {'dice_type': 'd6', 'dice_count': 99})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_skill_roll_returns_tier(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        skill = SkillFactory(character=char, current_value=50)
        api_client.force_authenticate(user=user)
        res = api_client.post(f'/api/characters/{char.id}/roll/', {
            'dice_type': 'd100',
            'dice_count': 1,
            'skill_id': skill.id,
        })
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['tier'] in ('critical', 'extreme', 'hard', 'regular', 'failure', 'fumble')


@pytest.mark.django_db
class TestCoCSuccessTiers:
    """Перевіряє логіку рівнів успіху CoC 7e."""

    def _roll_with_mock(self, api_client, char, skill, mocked_total):
        from unittest.mock import patch
        api_client.force_authenticate(user=char.user)
        with patch('apps.characters.views.roll_dice', return_value=([mocked_total], mocked_total)):
            return api_client.post(f'/api/characters/{char.id}/roll/', {
                'dice_type': 'd100',
                'dice_count': 1,
                'skill_id': skill.id,
            })

    def test_critical_success(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        skill = SkillFactory(character=char, current_value=50)
        res = self._roll_with_mock(api_client, char, skill, 3)
        assert res.data['tier'] == 'critical'

    def test_extreme_success(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        skill = SkillFactory(character=char, current_value=50)
        # extreme = skill // 5 = 10
        res = self._roll_with_mock(api_client, char, skill, 10)
        assert res.data['tier'] == 'extreme'

    def test_hard_success(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        skill = SkillFactory(character=char, current_value=50)
        # hard = skill // 2 = 25
        res = self._roll_with_mock(api_client, char, skill, 25)
        assert res.data['tier'] == 'hard'

    def test_regular_success(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        skill = SkillFactory(character=char, current_value=50)
        res = self._roll_with_mock(api_client, char, skill, 45)
        assert res.data['tier'] == 'regular'

    def test_failure(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        skill = SkillFactory(character=char, current_value=50)
        res = self._roll_with_mock(api_client, char, skill, 70)
        assert res.data['tier'] == 'failure'

    def test_fumble(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        skill = SkillFactory(character=char, current_value=50)
        res = self._roll_with_mock(api_client, char, skill, 98)
        assert res.data['tier'] == 'fumble'


@pytest.mark.django_db
class TestSkillImprovement:
    def test_improve_checked_skills(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        skill = SkillFactory(character=char, current_value=30, checked=True)
        api_client.force_authenticate(user=user)
        res = api_client.post(f'/api/characters/{char.id}/improve-skills/')
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) == 1
        result = res.data['results'][0]
        assert result['skill_id'] == skill.id
        assert result['old_value'] == 30
        # After improvement, checked must be reset
        skill.refresh_from_db()
        assert skill.checked is False

    def test_no_checked_skills_returns_error(self, api_client, db):
        user = UserFactory()
        char = CharacterFactory(user=user)
        SkillFactory(character=char, current_value=30, checked=False)
        api_client.force_authenticate(user=user)
        res = api_client.post(f'/api/characters/{char.id}/improve-skills/')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
