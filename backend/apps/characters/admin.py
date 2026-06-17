from django.contrib import admin
from .models import Character, Skill, DiceRoll, Equipment, MentalScar


class SkillInline(admin.TabularInline):
    model = Skill
    extra = 0

class EquipmentInline(admin.TabularInline):
    model = Equipment
    extra = 0


class MentalScarInline(admin.TabularInline):
    model = MentalScar
    extra = 0


@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'occupation', 'hp_current', 'hp_max', 'sanity_current', 'updated_at')
    list_filter = ('user',)
    search_fields = ('name', 'occupation')
    inlines = [SkillInline, EquipmentInline, MentalScarInline]


@admin.register(DiceRoll)
class DiceRollAdmin(admin.ModelAdmin):
    list_display = ('character', 'dice_type', 'dice_count', 'total', 'created_at')
    list_filter = ('dice_type', 'visible_to_all')
