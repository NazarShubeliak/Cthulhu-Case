import factory
from apps.users.tests.factories import UserFactory, MasterFactory
from apps.campaigns.models import Campaign, Act, Scene, NPC, CampaignAsset


class CampaignFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Campaign

    master = factory.SubFactory(MasterFactory)
    title = factory.Sequence(lambda n: f'Campaign {n}')
    description = 'Test campaign'
    setting = 'Arkham'
    era = '1923'


class ActFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Act

    campaign = factory.SubFactory(CampaignFactory)
    title = factory.Sequence(lambda n: f'Act {n}')
    order = factory.Sequence(lambda n: n)


class SceneFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Scene

    act = factory.SubFactory(ActFactory)
    title = factory.Sequence(lambda n: f'Scene {n}')
    description = 'Scene description'
    order = factory.Sequence(lambda n: n)


class NPCFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = NPC

    campaign = factory.SubFactory(CampaignFactory)
    name = factory.Sequence(lambda n: f'NPC {n}')
    description = 'An NPC'


class CampaignAssetFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CampaignAsset

    campaign = factory.SubFactory(CampaignFactory)
    title = factory.Sequence(lambda n: f'Asset {n}')
    type = 'document'
    content = 'Asset content'
    order = factory.Sequence(lambda n: n)
