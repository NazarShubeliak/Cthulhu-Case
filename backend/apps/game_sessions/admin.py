from django.contrib import admin
from .models import Session, Card, Note, Thread


class CardInline(admin.TabularInline):
    model = Card
    extra = 0
    fields = ('title', 'type', 'is_public', 'owner', 'created_by')
    readonly_fields = ('created_by',)


class NoteInline(admin.TabularInline):
    model = Note
    extra = 0
    fields = ('author', 'is_private', 'content')
    readonly_fields = ('author',)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ('name', 'master', 'status', 'player_count', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'master__username')
    inlines = [CardInline, NoteInline]

    def player_count(self, obj):
        return obj.players.count()
    player_count.short_description = 'Гравці'


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = ('title', 'type', 'session', 'created_by', 'owner', 'is_public', 'created_at')
    list_filter = ('type', 'is_public')
    search_fields = ('title', 'content')


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('author', 'session', 'is_private', 'created_at')
    list_filter = ('is_private',)
    search_fields = ('content', 'author__username')


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ('card_from', 'card_to', 'session', 'label', 'created_by')
    search_fields = ('label',)
