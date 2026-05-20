# CLAUDE.md — Cthulhu Case (CoC Platform)

## Загальний опис проєкту

Веб-платформа для настільної рольової гри **Call of Cthulhu** (Поклик Ктулху) у всесвіті Говарда Лавкрафта.
Сайт надає інструменти для гравців і майстрів: профілі, інтерактивні листи персонажів, віртуальний ігровий стіл з дошкою доказів і редактор сюжету для майстра.

**Назва:** Cthulhu Case
**Стек:** Django (backend) + React (frontend) + PostgreSQL + Redis + Docker + Nginx

---

## Готові макети
- У папці tmp там є готові макети для сайту по яким потрібно зробити сам сайт

---

## Ролі користувачів

| Роль | Опис |
|------|------|
| `player` | Звичайний гравець — має профіль, персонажів, доступ до столу |
| `master` | Майстер гри — управляє сюжетом, НПС, картками, доступом гравців |
| `admin` | Адміністратор сайту |

---

## Модулі платформи

### 1. Автентифікація і профіль

**Функціонал:**
- Реєстрація / вхід / вихід
- Профіль користувача: аватар, ім'я, біографія, список персонажів, статистика ігор

**Моделі:**
```
User
  - id, username, email, password
  - avatar, bio
  - role: player | master | admin
  - created_at
```

---

### 2. Лист персонажа (Character Sheet)

Інтерактивний лист за системою CoC 7-го видання. Всі зміни зберігаються в реальному часі.

**Характеристики (базові, 3-18 або відсотки):**
- STR (Сила), CON (Статура), SIZ (Розмір), DEX (Спритність)
- APP (Зовнішність), INT (Інтелект), POW (Воля), EDU (Освіта)

**Похідні значення:**
- HP (Здоров'я) = (CON + SIZ) / 10
- MP (Очки магії) = POW / 5
- Sanity (Здоровий глузд) — поточне / максимальне (99 - Cthulhu Mythos)
- Luck (Удача) — окремий ресурс, витрачається вручну

**Механіка Удачі:**
- Гравець має пул очок Удачі (наприклад 60)
- Якщо кинув більше потрібного — може витратити різницю з пулу Удачі щоб зарахувати успіх
- Приклад: потрібно 40%, кинув 50% → витрачає 10 очок Удачі
- Пул відображається як цифра з кнопкою "витратити X"

**Навички:**
- Список ~50 навичок у відсотках (0-100%)
- Кожна навичка має базове значення і поточне
- Гравець може позначити навичку для підвищення після сесії

**Кубики прямо на сайті:**
- Гравець натискає на навичку → відкривається панель кидка
- Вибирає кількість і тип кубиків: d4, d6, d8, d10, d100
- Кидає → результат видно всім за столом або тільки гравцю (налаштування)
- Основний кидок CoC: d100 (два d10)

**Моделі:**
```
Character
  - id, user (FK), name, occupation, age, backstory
  - str, con, siz, dex, app, int, pow, edu
  - hp_current, hp_max
  - mp_current, mp_max
  - sanity_current, sanity_max, sanity_starting
  - luck_current, luck_max
  - portrait_image
  - created_at, updated_at

Skill
  - id, character (FK)
  - name, base_value, current_value
  - checked (для підвищення після сесії)

DiceRoll
  - id, character (FK), session (FK)
  - dice_type, dice_count, results (JSON), total
  - skill (FK, nullable)
  - visible_to_all (bool)
  - created_at
```

---

### 3. Ігровий стіл (Virtual Table)

Центральний модуль. Кожна гра = окрема сесія (лобі).

**Структура доступу до карток:**

```
Майстер створює картку
        ↓
    Три варіанти:
    │
    ├── 1. Відправити конкретному гравцю (особистий простір)
    │           ↓
    │       Гравець бачить тільки у себе
    │           ↓
    │       ├── Залишає у себе (особисті нотатки)
    │       └── Виносить на загальний стіл
    │                   ↓
    │           Вся група бачить картку
    │
    ├── 2. Додати напряму на загальний стіл
    │           ↓
    │       Всі бачать одразу (карта міста, газета, загальний факт)
    │
    └── 3. Залишити у себе (чернетка)
                ↓
            Ніхто не бачить поки майстер не вирішить відправити
```

Будь-хто може тягнути червоні нитки між картками на загальному столі.

**Типи карток:**
- `document` — текстовий документ, лист, записка
- `photo` — зображення (локація, НПС, артефакт)
- `note` — вільна нотатка гравця
- `npc` — картка персонажа (ім'я, фото, опис)
- `location` — картка місця

**Нотатки:**
- Особисті — видно тільки власнику, майстер не бачить
- Загальні — видно всій групі і майстру

**Дошка доказів (Evidence Board):**
- Картки розміщуються на полотні з координатами (x, y)
- Гравці тягнуть червоні нитки між картками (з'єднання)
- Кожна нитка може мати підпис (наприклад "бачили разом")
- Майстер може додавати картки напряму на загальний стіл або в особистий простір гравця

**Моделі:**
```
Session (лобі)
  - id, name, master (FK User)
  - players (M2M User)
  - status: lobby | active | closed
  - created_at

Card
  - id, session (FK)
  - type: document | photo | note | npc | location
  - title, content (text), image (nullable)
  - created_by (FK User)
  - owner (FK User, nullable) — якщо особиста картка гравця
  - is_public (bool) — чи винесена на загальний стіл
  - pos_x, pos_y (float) — позиція на дошці
  - created_at

Thread (червона нитка)
  - id, session (FK)
  - card_from (FK Card), card_to (FK Card)
  - label (text, nullable)
  - created_by (FK User)

Note
  - id, session (FK), author (FK User)
  - content (text)
  - is_private (bool)
  - created_at, updated_at
```

**WebSocket (Django Channels + Redis):**
- Всі зміни на дошці в реальному часі
- Нові картки, нові нитки, переміщення карток
- Кидки кубиків (якщо публічні)
- Нові загальні нотатки

---

### 4. Редактор сюжету (Story Editor) — тільки для майстра

Окремий інструмент де майстер будує свою кампанію.

**Структура:**
```
Campaign (кампанія)
  └── Act (акт, наприклад "Акт 1: Прибуття до Аркгему")
        └── Scene (сцена, наприклад "Бібліотека Містекатонік")
              ├── description (текст, що відбувається)
              ├── npcs (список НПС в сцені)
              ├── locations (пов'язані локації)
              └── cards (картки які стають доступні в цій сцені)
```

**Функціонал редактора:**
- Rich text редактор для опису сцен
- Список НПС з іменем, описом, фото, секретами
- Прив'язка карток до сцен — майстер в потрібний момент "відправляє" картку гравцю
- Нотатки майстра (гравці не бачать ніколи)
- Трекер що вже знають гравці

**Моделі:**
```
Campaign
  - id, master (FK User), title, description
  - setting, era (наприклад "Аркгем, 1923")
  - created_at

Act
  - id, campaign (FK), title, order (int)

Scene
  - id, act (FK), title, description (rich text)
  - order (int), master_notes (text, приватне)

NPC
  - id, campaign (FK)
  - name, description, secret_info
  - portrait_image
  - scenes (M2M Scene)

SceneCard
  - id, scene (FK), card (FK Card)
  - sent_to (FK User, nullable) — кому відправити
  - is_sent (bool)
```

---

## API структура (Django REST Framework)

```
/api/auth/
  POST /register/
  POST /login/
  POST /logout/
  GET  /me/

/api/characters/
  GET    /                    — список персонажів користувача
  POST   /                    — створити персонажа
  GET    /{id}/               — деталі персонажа
  PATCH  /{id}/               — оновити (автозбереження)
  DELETE /{id}/
  POST   /{id}/roll/          — кинути кубики

/api/sessions/
  GET    /                    — список сесій користувача
  POST   /                    — створити лобі (тільки майстер)
  GET    /{id}/               — деталі сесії
  POST   /{id}/join/          — приєднатись
  GET    /{id}/cards/         — картки сесії (з фільтром по доступу)
  POST   /{id}/cards/         — створити картку
  PATCH  /{id}/cards/{card_id}/
  POST   /{id}/cards/{card_id}/publish/ — винести на загальний стіл
  GET    /{id}/threads/       — нитки
  POST   /{id}/threads/       — створити нитку
  DELETE /{id}/threads/{thread_id}/
  GET    /{id}/notes/         — нотатки
  POST   /{id}/notes/

/api/campaigns/
  GET    /
  POST   /
  GET    /{id}/
  PATCH  /{id}/
  POST   /{id}/scenes/{scene_id}/send-card/ — відправити картку гравцю
```

---

## WebSocket channels

```
ws/session/{session_id}/   — головний канал столу
  Events:
    card.created           — нова картка на загальному столі
    card.moved             — картка переміщена (x, y)
    card.published         — гравець виніс картку на стіл
    thread.created         — нова нитка
    thread.deleted
    note.created           — нова загальна нотатка
    dice.rolled            — публічний кидок кубиків
    player.joined          — гравець приєднався
```

---

## Структура React застосунку

```
src/
  pages/
    Auth/           — Login, Register
    Profile/        — сторінка профілю
    Characters/     — список і редактор персонажів
    Sessions/       — список лобі
    Table/          — віртуальний стіл (головна сторінка гри)
    StoryEditor/    — редактор сюжету (тільки майстер)

  components/
    CharacterSheet/ — повний лист персонажа
    DiceRoller/     — панель кидків кубиків
    EvidenceBoard/  — дошка з картками і нитками
    CardItem/       — окрема картка
    NoteEditor/     — редактор нотаток
    MasterPanel/    — панель майстра (відправка карток, керування)

  store/            — Redux або Zustand для стану столу
  hooks/            — useWebSocket, useDiceRoll, useCharacter
  api/              — axios клієнт і всі запити
```

---

## Docker структура

```
docker-compose.yml
  services:
    web      — Django (gunicorn)
    frontend — React (nginx або vite dev)
    db       — PostgreSQL
    redis    — Redis (WebSocket + кеш)
    nginx    — реверс-проксі
```

---

## Пріоритет розробки

1. **Фаза 1** — Реєстрація, профіль, базовий лист персонажа
2. **Фаза 2** — Сесії, лобі, базовий стіл, нотатки
3. **Фаза 3** — Дошка доказів, картки, червоні нитки, WebSocket
4. **Фаза 4** — Редактор сюжету для майстра
5. **Фаза 5** — Полірування дизайну, мобільна версія