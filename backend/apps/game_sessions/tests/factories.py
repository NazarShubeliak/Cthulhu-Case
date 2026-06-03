import factory
from apps.users.tests.factories import UserFactory, MasterFactory
from apps.game_sessions.models import Session, Card, Thread, Note


class SessionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Session

    name = factory.Sequence(lambda n: f'Сесія {n}')
    master = factory.SubFactory(MasterFactory)
    status = 'lobby'


class CardFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Card

    session = factory.SubFactory(SessionFactory)
    type = 'document'
    title = factory.Sequence(lambda n: f'Картка {n}')
    content = 'Тестовий вміст'
    created_by = factory.LazyAttribute(lambda o: o.session.master)
    is_public = True
    pos_x = 100.0
    pos_y = 100.0


class NoteFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Note

    session = factory.SubFactory(SessionFactory)
    author = factory.SubFactory(UserFactory)
    content = 'Тестова нотатка'
    is_private = False
