from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('campaigns', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CampaignAsset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('npc', 'NPC'), ('document', 'Document'), ('photo', 'Photo'), ('note', 'Note')], max_length=20)),
                ('title', models.CharField(max_length=200)),
                ('content', models.TextField(blank=True)),
                ('image', models.ImageField(blank=True, null=True, upload_to='campaign_assets/')),
                ('order', models.PositiveIntegerField(default=0)),
                ('campaign', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assets', to='campaigns.campaign')),
            ],
            options={
                'db_table': 'campaign_assets',
                'ordering': ['order', 'id'],
            },
        ),
    ]
