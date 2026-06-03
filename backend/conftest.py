import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(user_factory):
    user = user_factory()
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user
