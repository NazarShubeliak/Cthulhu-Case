from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Equipment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('notes', models.CharField(blank=True, max_length=100)),
                ('order', models.PositiveIntegerField(default=0)),
                ('character', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='equipment',
                    to='characters.character',
                )),
            ],
            options={
                'db_table': 'equipment',
                'ordering': ['order', 'id'],
            },
        ),
    ]
