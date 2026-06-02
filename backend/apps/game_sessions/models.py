import random
import string

from django.db import models, IntegrityError
from django.conf import settings


def _generate_join_code():
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=6))


class Session(models.Model):
    STATUS_CHOICES = [
        ('lobby', 'Лобі'),
        ('active', 'Активна'),
        ('closed', 'Закрита'),
    ]
    name = models.CharField(max_length=200)
    master = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='mastered_sessions'
    )
    players = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name='joined_sessions', blank=True
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='lobby')
    description = models.TextField(blank=True)
    join_code = models.CharField(max_length=6, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.join_code:
            # Генеруємо код і повторюємо при колізії — БД гарантує унікальність атомарно
            while True:
                self.join_code = _generate_join_code()
                try:
                    super().save(*args, **kwargs)
                    return
                except IntegrityError:
                    continue
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def is_participant(self, user):
        return self.master == user or self.players.filter(pk=user.pk).exists()


class Card(models.Model):
    CARD_TYPES = [
        ('document', 'Документ'),
        ('photo', 'Фото'),
        ('note', 'Нотатка'),
        ('npc', 'НПС'),
        ('sketch', 'Ескіз'),
    ]
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='cards')
    type = models.CharField(max_length=20, choices=CARD_TYPES, default='document')
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    image = models.ImageField(upload_to='cards/', null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_cards'
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='owned_cards'
    )
    drawing_data = models.JSONField(default=list, blank=True)
    is_public = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    pos_x = models.FloatField(default=0)
    pos_y = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cards'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Thread(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='threads')
    card_from = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='threads_from')
    card_to = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='threads_to')
    label = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_threads'
    )

    class Meta:
        db_table = 'threads'
        unique_together = [['card_from', 'card_to']]
        ordering = ['id']

    def __str__(self):
        return f'Thread {self.card_from_id} → {self.card_to_id}'


class SessionCharacter(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='session_characters')
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='session_characters'
    )
    character = models.ForeignKey(
        'characters.Character', on_delete=models.CASCADE, related_name='session_bindings'
    )

    class Meta:
        db_table = 'session_characters'
        unique_together = [['session', 'player']]

    def __str__(self):
        return f'{self.player} → {self.character} in {self.session}'


class Note(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notes'
    )
    content = models.TextField()
    is_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notes'
        ordering = ['-created_at']

    def __str__(self):
        return f'Note by {self.author} in {self.session}'
