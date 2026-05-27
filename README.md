# Cthulhu Case

A web platform for playing **Call of Cthulhu** (7th edition) online. Built by Frog & Force.

## What it does

- **Character sheets** — full CoC 7e mechanics: 8 core stats, 35+ skills, derived HP/MP/Sanity/Luck, d100 dice roller with success tiers (critical / extreme / hard / regular / failure / fumble), skill improvement after sessions
- **Evidence board** — drag-and-drop cards (documents, photos, NPCs, notes) on a cork canvas, red threads with labels between cards, real-time sync via WebSocket
- **Sessions** — lobby system with 6-character join codes, 3-level card access (private → player → public board), master and player roles per session
- **Story editor** — Campaign → Act → Scene hierarchy, NPC management with portraits, scene cards that the keeper sends to players at the right moment, campaign assets bulk-loaded to the table
- **Real-time** — Django Channels + Redis WebSocket, all board changes broadcast instantly

## Stack

| Layer | Tech |
|---|---|
| Backend | Django 4.2 · Django REST Framework · Django Channels |
| Auth | JWT (SimpleJWT) — 7d access / 30d refresh |
| Database | PostgreSQL 16 |
| Cache / WS | Redis 7 |
| Frontend | React 18 · Vite · Zustand · React Router |
| i18n | i18next — Ukrainian / English |
| Server | Daphne (ASGI) · Nginx |
| Infra | Docker Compose |

## Quick start

**Requirements:** Docker Desktop

```bash
git clone <repo>
cd Cthulhu-Case
cp .env.example .env        # fill in secrets
docker-compose up -d --build
```

App available at `http://localhost` (Nginx proxy).  
API at `http://localhost/api/` · Frontend dev at `http://localhost:3000`.

### First run

```bash
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py createsuperuser
```

## Project structure

```
backend/
  apps/
    users/          — auth, JWT, user profiles
    characters/     — character sheets, skills, dice rolls
    game_sessions/  — sessions, cards, threads, notes, WebSocket consumer
    campaigns/      — story editor: campaigns, acts, scenes, NPCs, assets
  config/           — Django settings, URL routing, ASGI + WebSocket routing

frontend/
  src/
    pages/          — Auth, Profile, Characters, Sessions, Table, StoryEditor
    components/     — EvidenceBoard, GlitchText, CursorLamp, Layout
    store/          — Zustand: authStore, tableStore, uiStore
    api/            — Axios clients for all endpoints
    i18n/           — uk.json, en.json

nginx/              — reverse proxy config
scripts/            — backup.sh, restore.sh, migrate.sh, logs.sh
```

## API overview

```
POST /api/auth/register/
POST /api/auth/login/
GET  /api/auth/me/

GET  /api/characters/
POST /api/characters/{id}/roll/

GET  /api/sessions/
POST /api/sessions/{id}/join/
POST /api/sessions/join-by-code/
GET  /api/sessions/{id}/cards/
POST /api/sessions/{id}/threads/

GET  /api/campaigns/
GET  /api/campaigns/{id}/acts/{id}/scenes/{id}/
POST /api/campaigns/{id}/acts/{id}/scenes/{id}/cards/{id}/send/

ws://host/ws/session/{id}/?token=<jwt>
```

## WebSocket events

| Event | Trigger |
|---|---|
| `card.created` | New card published to board |
| `card.moved` | Card dragged to new position |
| `card.published` | Player moves card to public board |
| `thread.created` | Red thread drawn between cards |
| `thread.deleted` | Thread removed |
| `note.created` | New public note |
| `dice.rolled` | Public dice roll |
| `player.joined` | Player joins session |

## Development

```bash
# Backend logs
docker-compose logs -f web

# Frontend logs
docker-compose logs -f frontend

# Django shell
docker-compose exec web python manage.py shell

# Run migrations
docker-compose exec web python manage.py migrate
```

## Scripts

```bash
scripts/backup.sh    — dump PostgreSQL to file
scripts/restore.sh   — restore from dump
scripts/migrate.sh   — run migrations inside container
scripts/logs.sh      — tail all container logs
```

---

© Frog & Force — building worlds, one session at a time.
