from django.contrib import admin
from .models import Campaign, Act, Scene, NPC, SceneCard

admin.site.register(Campaign)
admin.site.register(Act)
admin.site.register(Scene)
admin.site.register(NPC)
admin.site.register(SceneCard)
