import factory
from apps.users.tests.factories import UserFactory
from apps.characters.models import Character, Skill


class CharacterFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Character

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f'Персонаж {n}')
    occupation = 'Детектив'
    age = 30
    str_stat = 50
    con_stat = 50
    siz_stat = 50
    dex_stat = 50
    app_stat = 50
    int_stat = 60
    pow_stat = 60
    edu_stat = 70
    hp_max = 10
    hp_current = 10
    mp_max = 12
    mp_current = 12
    sanity_max = 99
    sanity_current = 60
    luck_max = 60
    luck_current = 60


class SkillFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Skill

    character = factory.SubFactory(CharacterFactory)
    name = factory.Sequence(lambda n: f'Навичка {n}')
    base_value = 20
    current_value = 20
    checked = False
