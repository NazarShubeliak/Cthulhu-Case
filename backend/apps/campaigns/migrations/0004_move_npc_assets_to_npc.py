from django.db import migrations


def move_npc_assets(apps, schema_editor):
    CampaignAsset = apps.get_model('campaigns', 'CampaignAsset')
    NPC = apps.get_model('campaigns', 'NPC')
    npc_assets = CampaignAsset.objects.filter(type='npc')
    for asset in npc_assets:
        NPC.objects.create(
            campaign=asset.campaign,
            name=asset.title,
            description=asset.content,
            portrait_image=asset.image,
        )
    npc_assets.delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('campaigns', '0003_remove_npc_scenes_npc_age_npc_appearance_and_more'),
    ]

    operations = [
        migrations.RunPython(move_npc_assets, noop),
    ]
