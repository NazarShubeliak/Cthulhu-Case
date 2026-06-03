import pytest
from django.urls import reverse
from rest_framework import status

from .factories import UserFactory


@pytest.fixture
def user_factory(db):
    return UserFactory


@pytest.mark.django_db
class TestRegister:
    url = '/api/auth/register/'

    def test_success(self, api_client):
        data = {'username': 'newuser', 'email': 'new@test.com', 'password': 'StrongPass123', 'password2': 'StrongPass123'}
        res = api_client.post(self.url, data)
        assert res.status_code == status.HTTP_201_CREATED
        assert 'access' in res.data
        assert 'refresh' in res.data
        assert res.data['user']['username'] == 'newuser'
        assert res.data['user']['role'] == 'player'

    def test_duplicate_username(self, api_client, db):
        UserFactory(username='taken')
        res = api_client.post(self.url, {'username': 'taken', 'email': 'x@test.com', 'password': 'pass123'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_fields(self, api_client):
        res = api_client.post(self.url, {'username': 'only'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogin:
    url = '/api/auth/login/'

    def test_success(self, api_client, db):
        UserFactory(username='alice', password=None)
        from apps.users.models import User
        user = User.objects.get(username='alice')
        user.set_password('secret')
        user.save()

        res = api_client.post(self.url, {'username': 'alice', 'password': 'secret'})
        assert res.status_code == status.HTTP_200_OK
        assert 'access' in res.data
        assert 'refresh' in res.data

    def test_wrong_password(self, api_client, db):
        UserFactory(username='bob')
        res = api_client.post(self.url, {'username': 'bob', 'password': 'wrong'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_nonexistent_user(self, api_client):
        res = api_client.post(self.url, {'username': 'ghost', 'password': 'any'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestMe:
    url = '/api/auth/me/'

    def test_authenticated(self, api_client, db):
        user = UserFactory()
        api_client.force_authenticate(user=user)
        res = api_client.get(self.url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data['username'] == user.username
        assert res.data['role'] == user.role

    def test_unauthenticated(self, api_client):
        res = api_client.get(self.url)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_patch_bio(self, api_client, db):
        user = UserFactory()
        api_client.force_authenticate(user=user)
        res = api_client.patch(self.url, {'bio': 'Дослідник НКС'})
        assert res.status_code == status.HTTP_200_OK
        assert res.data['bio'] == 'Дослідник НКС'


@pytest.mark.django_db
class TestLogout:
    url = '/api/auth/logout/'

    def test_success(self, api_client, db):
        user = UserFactory()
        api_client.force_authenticate(user=user)
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = str(RefreshToken.for_user(user))
        res = api_client.post(self.url, {'refresh': refresh})
        assert res.status_code == status.HTTP_200_OK

    def test_unauthenticated(self, api_client):
        res = api_client.post(self.url, {'refresh': 'invalid'})
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestChangePassword:
    url = '/api/auth/change-password/'

    def test_success(self, api_client, db):
        user = UserFactory()
        api_client.force_authenticate(user=user)
        res = api_client.post(self.url, {
            'current_password': 'password123',
            'new_password': 'NewSecure456',
            'new_password2': 'NewSecure456',
        })
        assert res.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password('NewSecure456')

    def test_wrong_old_password(self, api_client, db):
        user = UserFactory()
        api_client.force_authenticate(user=user)
        res = api_client.post(self.url, {
            'current_password': 'wrongold',
            'new_password': 'NewSecure456',
            'new_password2': 'NewSecure456',
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
