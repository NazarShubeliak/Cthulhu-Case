from django.db import models
from django.conf import settings


class Campaign(models.Model):
    master = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='campaigns'
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    setting = models.CharField(max_length=200, blank=True)
    era = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaigns'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Act(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='acts')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'campaign_acts'
        ordering = ['order', 'id']

    def __str__(self):
        return self.title


class Scene(models.Model):
    act = models.ForeignKey(Act, on_delete=models.CASCADE, related_name='scenes')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    master_notes = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'campaign_scenes'
        ordering = ['order', 'id']

    def __str__(self):
        return self.title


class NPC(models.Model):
    STATUS_CHOICES = [
        ('alive', 'Alive'),
        ('dead', 'Dead'),
        ('missing', 'Missing'),
        ('suspect', 'Suspect'),
    ]
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='npcs')
    name = models.CharField(max_length=200)
    age = models.CharField(max_length=50, blank=True)
    occupation = models.CharField(max_length=200, blank=True)
    appearance = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='alive')
    description = models.TextField(blank=True)
    secret_info = models.TextField(blank=True)
    portrait_image = models.ImageField(upload_to='npcs/', null=True, blank=True)

    class Meta:
        db_table = 'campaign_npcs'
        ordering = ['name']

    def __str__(self):
        return self.name


class CampaignAsset(models.Model):
    ASSET_TYPES = [
        ('document', 'Document'),
        ('photo', 'Photo'),
        ('note', 'Note'),
        ('map', 'Map'),
    ]
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='assets')
    type = models.CharField(max_length=20, choices=ASSET_TYPES)
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    image = models.ImageField(upload_to='campaign_assets/', null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'campaign_assets'
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.type}: {self.title}'
