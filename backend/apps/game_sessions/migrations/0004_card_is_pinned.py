from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('game_sessions', '0003_add_join_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='card',
            name='is_pinned',
            field=models.BooleanField(default=False),
        ),
    ]
