from django.db import models
from django.conf import settings


class Character(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='characters',
    )
    name = models.CharField(max_length=100)
    occupation = models.CharField(max_length=100, blank=True)
    age = models.PositiveIntegerField(null=True, blank=True)
    residence = models.CharField(max_length=200, blank=True)
    birthplace = models.CharField(max_length=200, blank=True)
    backstory = models.TextField(blank=True)
    portrait_image = models.ImageField(upload_to='portraits/', null=True, blank=True)

    # Core stats (0-99)
    str_stat = models.PositiveIntegerField(default=50)
    con_stat = models.PositiveIntegerField(default=50)
    siz_stat = models.PositiveIntegerField(default=50)
    dex_stat = models.PositiveIntegerField(default=50)
    app_stat = models.PositiveIntegerField(default=50)
    int_stat = models.PositiveIntegerField(default=50)
    pow_stat = models.PositiveIntegerField(default=50)
    edu_stat = models.PositiveIntegerField(default=50)

    # Derived (stored for quick access, recalculated on stat change)
    hp_current = models.PositiveIntegerField(default=10)
    hp_max = models.PositiveIntegerField(default=10)
    mp_current = models.PositiveIntegerField(default=10)
    mp_max = models.PositiveIntegerField(default=10)
    sanity_current = models.PositiveIntegerField(default=75)
    sanity_max = models.PositiveIntegerField(default=99)
    sanity_starting = models.PositiveIntegerField(default=75)
    luck_current = models.PositiveIntegerField(default=60)
    luck_max = models.PositiveIntegerField(default=60)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'characters'
        ordering = ['-updated_at']

    def __str__(self):
        return self.name


class Skill(models.Model):
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='skills')
    name = models.CharField(max_length=100)
    base_value = models.PositiveIntegerField(default=5)
    current_value = models.PositiveIntegerField(default=5)
    checked = models.BooleanField(default=False)

    class Meta:
        db_table = 'skills'
        ordering = ['name']

    def __str__(self):
        return f'{self.character.name} — {self.name}'


class DiceRoll(models.Model):
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='dice_rolls')
    dice_type = models.CharField(max_length=10)  # d4, d6, d8, d10, d100
    dice_count = models.PositiveIntegerField(default=1)
    results = models.JSONField(default=list)
    total = models.PositiveIntegerField(default=0)
    skill = models.ForeignKey(Skill, on_delete=models.SET_NULL, null=True, blank=True)
    visible_to_all = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dice_rolls'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.character.name}: {self.dice_count}{self.dice_type}={self.total}'
