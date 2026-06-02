from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('game_sessions', '0006_session_character'),
    ]

    operations = [
        migrations.AddField(
            model_name='card',
            name='drawing_data',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name='card',
            name='type',
            field=models.CharField(
                choices=[
                    ('document', 'Документ'),
                    ('photo', 'Фото'),
                    ('note', 'Нотатка'),
                    ('npc', 'НПС'),
                    ('sketch', 'Ескіз'),
                ],
                default='document',
                max_length=20,
            ),
        ),
    ]
