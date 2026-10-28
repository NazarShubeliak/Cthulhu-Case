import pytest
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _clear_cache():
    # The login/register throttle counts requests in the cache — don't let
    # one test's logins eat into the next test's budget.
    from django.core.cache import cache
    cache.clear()
    yield


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(user_factory):
    user = user_factory()
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user
