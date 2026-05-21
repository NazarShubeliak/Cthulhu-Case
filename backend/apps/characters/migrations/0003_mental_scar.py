from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0002_equipment'),
    ]

    operations = [
        migrations.CreateModel(
            name='MentalScar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('scar_type', models.CharField(
                    choices=[('phobia', 'Фобія'), ('mania', 'Манія')],
                    default='phobia',
                    max_length=10,
                )),
                ('character', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mental_scars',
                    to='characters.character',
                )),
            ],
            options={
                'db_table': 'mental_scars',
                'ordering': ['id'],
            },
        ),
    ]
