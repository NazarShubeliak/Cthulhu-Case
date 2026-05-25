from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('game_sessions', '0005_alter_card_type'),
        ('characters', '0003_mental_scar'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SessionCharacter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='session_characters',
                    to='game_sessions.session',
                )),
                ('player', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='session_characters',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('character', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='session_bindings',
                    to='characters.character',
                )),
            ],
            options={
                'db_table': 'session_characters',
                'unique_together': {('session', 'player')},
            },
        ),
    ]
