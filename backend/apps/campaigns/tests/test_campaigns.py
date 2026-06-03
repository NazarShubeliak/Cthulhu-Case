import pytest
from rest_framework import status

from apps.users.tests.factories import UserFactory, MasterFactory
from .factories import CampaignFactory, ActFactory, SceneFactory, NPCFactory, CampaignAssetFactory


# ── Campaigns ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCampaignCRUD:
    url = '/api/campaigns/'

    def test_master_can_create(self, api_client, db):
        master = MasterFactory()
        api_client.force_authenticate(user=master)
        res = api_client.post(self.url, {'title': 'Horror in Arkham', 'setting': 'Arkham', 'era': '1923'})
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['title'] == 'Horror in Arkham'
        assert res.data['master']['id'] == master.id

    def test_unauthenticated_denied(self, api_client):
        res = api_client.post(self.url, {'title': 'Test'})
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_only_own(self, api_client, db):
        master = MasterFactory()
        other = MasterFactory()
        CampaignFactory(master=master)
        CampaignFactory(master=master)
        CampaignFactory(master=other)
        api_client.force_authenticate(user=master)
        res = api_client.get(self.url)
        results = res.data.get('results', res.data)
        assert len(results) == 2

    def test_retrieve(self, api_client, db):
        campaign = CampaignFactory()
        api_client.force_authenticate(user=campaign.master)
        res = api_client.get(f'{self.url}{campaign.id}/')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['id'] == campaign.id

    def test_other_master_cannot_retrieve(self, api_client, db):
        campaign = CampaignFactory()
        other = MasterFactory()
        api_client.force_authenticate(user=other)
        res = api_client.get(f'{self.url}{campaign.id}/')
        assert res.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_update(self, api_client, db):
        campaign = CampaignFactory()
        api_client.force_authenticate(user=campaign.master)
        res = api_client.patch(f'{self.url}{campaign.id}/', {'title': 'Updated'})
        assert res.status_code == status.HTTP_200_OK
        assert res.data['title'] == 'Updated'

    def test_delete(self, api_client, db):
        campaign = CampaignFactory()
        api_client.force_authenticate(user=campaign.master)
        res = api_client.delete(f'{self.url}{campaign.id}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT


# ── Acts ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestActs:
    def url(self, campaign_id):
        return f'/api/campaigns/{campaign_id}/acts/'

    def test_create_act(self, api_client, db):
        campaign = CampaignFactory()
        api_client.force_authenticate(user=campaign.master)
        res = api_client.post(self.url(campaign.id), {'title': 'Act 1', 'order': 1})
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['title'] == 'Act 1'

    def test_list_acts(self, api_client, db):
        campaign = CampaignFactory()
        ActFactory(campaign=campaign)
        ActFactory(campaign=campaign)
        api_client.force_authenticate(user=campaign.master)
        res = api_client.get(self.url(campaign.id))
        results = res.data.get('results', res.data)
        assert len(results) == 2

    def test_non_master_denied(self, api_client, db):
        campaign = CampaignFactory()
        other = MasterFactory()
        api_client.force_authenticate(user=other)
        res = api_client.get(self.url(campaign.id))
        assert res.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_delete_act(self, api_client, db):
        act = ActFactory()
        api_client.force_authenticate(user=act.campaign.master)
        res = api_client.delete(f'/api/campaigns/{act.campaign.id}/acts/{act.id}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT


# ── Scenes ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestScenes:
    def url(self, campaign_id, act_id):
        return f'/api/campaigns/{campaign_id}/acts/{act_id}/scenes/'

    def test_create_scene(self, api_client, db):
        act = ActFactory()
        api_client.force_authenticate(user=act.campaign.master)
        res = api_client.post(
            self.url(act.campaign.id, act.id),
            {'title': 'Library', 'description': 'Miskatonic Library', 'order': 1},
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['title'] == 'Library'

    def test_list_scenes(self, api_client, db):
        act = ActFactory()
        SceneFactory(act=act)
        SceneFactory(act=act)
        api_client.force_authenticate(user=act.campaign.master)
        res = api_client.get(self.url(act.campaign.id, act.id))
        results = res.data.get('results', res.data)
        assert len(results) == 2

    def test_update_master_notes(self, api_client, db):
        scene = SceneFactory()
        api_client.force_authenticate(user=scene.act.campaign.master)
        res = api_client.patch(
            f'/api/campaigns/{scene.act.campaign.id}/acts/{scene.act.id}/scenes/{scene.id}/',
            {'master_notes': 'Secret info'},
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data['master_notes'] == 'Secret info'


# ── NPCs ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestNPCs:
    def url(self, campaign_id):
        return f'/api/campaigns/{campaign_id}/npcs/'

    def test_create_npc(self, api_client, db):
        campaign = CampaignFactory()
        api_client.force_authenticate(user=campaign.master)
        res = api_client.post(self.url(campaign.id), {'name': 'Herbert West', 'description': 'Doctor'})
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['name'] == 'Herbert West'

    def test_list_npcs(self, api_client, db):
        campaign = CampaignFactory()
        NPCFactory(campaign=campaign)
        NPCFactory(campaign=campaign)
        api_client.force_authenticate(user=campaign.master)
        res = api_client.get(self.url(campaign.id))
        results = res.data.get('results', res.data)
        assert len(results) == 2

    def test_delete_npc(self, api_client, db):
        npc = NPCFactory()
        api_client.force_authenticate(user=npc.campaign.master)
        res = api_client.delete(f'/api/campaigns/{npc.campaign.id}/npcs/{npc.id}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT

    def test_non_master_denied(self, api_client, db):
        campaign = CampaignFactory()
        other = UserFactory()
        api_client.force_authenticate(user=other)
        res = api_client.get(self.url(campaign.id))
        assert res.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)


# ── Campaign Assets ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCampaignAssets:
    def url(self, campaign_id):
        return f'/api/campaigns/{campaign_id}/assets/'

    def test_create_asset(self, api_client, db):
        campaign = CampaignFactory()
        api_client.force_authenticate(user=campaign.master)
        res = api_client.post(
            self.url(campaign.id),
            {'title': 'Newspaper', 'type': 'document', 'content': 'Strange events...', 'order': 1},
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['title'] == 'Newspaper'
        assert res.data['type'] == 'document'

    def test_list_assets(self, api_client, db):
        campaign = CampaignFactory()
        CampaignAssetFactory(campaign=campaign)
        CampaignAssetFactory(campaign=campaign, type='photo')
        api_client.force_authenticate(user=campaign.master)
        res = api_client.get(self.url(campaign.id))
        results = res.data.get('results', res.data)
        assert len(results) == 2

    def test_update_asset(self, api_client, db):
        asset = CampaignAssetFactory()
        api_client.force_authenticate(user=asset.campaign.master)
        res = api_client.patch(
            f'/api/campaigns/{asset.campaign.id}/assets/{asset.id}/',
            {'title': 'Updated'},
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data['title'] == 'Updated'

    def test_delete_asset(self, api_client, db):
        asset = CampaignAssetFactory()
        api_client.force_authenticate(user=asset.campaign.master)
        res = api_client.delete(f'/api/campaigns/{asset.campaign.id}/assets/{asset.id}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT

    def test_non_master_denied(self, api_client, db):
        campaign = CampaignFactory()
        other = UserFactory()
        api_client.force_authenticate(user=other)
        res = api_client.get(self.url(campaign.id))
        assert res.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
