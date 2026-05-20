import random
import string

from django.db import migrations, models


def generate_unique_codes(apps, schema_editor):
    Session = apps.get_model('game_sessions', 'Session')
    used = set()
    for session in Session.objects.all():
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if code not in used:
                used.add(code)
                session.join_code = code
                session.save(update_fields=['join_code'])
                break


class Migration(migrations.Migration):

    dependencies = [
        ('game_sessions', '0002_add_thread'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='join_code',
            field=models.CharField(max_length=6, blank=True, default=''),
        ),
        migrations.RunPython(generate_unique_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='session',
            name='join_code',
            field=models.CharField(max_length=6, unique=True, blank=True),
        ),
    ]
