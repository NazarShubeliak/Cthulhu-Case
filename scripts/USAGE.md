# Scripts — Cthulhu Case

Всі скрипти запускаються з Git Bash, WSL або будь-якого bash-термінала.

Перший раз зроби їх виконуваними:
```bash
chmod +x scripts/*.sh
```

---

## backup.sh — Бекап бази даних

Робить дамп PostgreSQL у папку `scripts/backups/` з міткою часу.

```bash
./scripts/backup.sh
# → backups/backup_2025-05-18_14-30-00.sql
```

---

## restore.sh — Відновлення бази

Без аргументу — показує список бекапів і питає який взяти.
З аргументом — відразу відновлює вказаний файл.

```bash
./scripts/restore.sh
./scripts/restore.sh backup_2025-05-18_14-30-00.sql
./scripts/restore.sh /повний/шлях/до/файлу.sql
```

> **Увага:** перед відновленням базу буде видалено і створено заново.

---

## reset.sh — Повний перезапуск

Зупиняє контейнери, **видаляє всі volumes** (дані БД!), збирає образи заново, запускає і мігрує.

```bash
./scripts/reset.sh              # зі збереженим кешем Docker
./scripts/reset.sh --no-cache   # чистий білд (повільніше)
```

> **Увага:** всі дані в базі буде знищено. Зроби бекап перед запуском.

---

## test.sh — Запуск тестів

```bash
./scripts/test.sh               # backend + frontend
./scripts/test.sh --be          # тільки backend (pytest)
./scripts/test.sh --fe          # тільки frontend (vitest)

./scripts/test.sh --be -k transfer         # backend: фільтр по назві тесту
./scripts/test.sh --be apps/game_sessions/ # backend: конкретна папка
```

---

## migrate.sh — Міграції Django

```bash
./scripts/migrate.sh                        # тільки apply
./scripts/migrate.sh --make                 # makemigrations + migrate
./scripts/migrate.sh --make characters      # для конкретного app
```

---

## logs.sh — Логи контейнерів

```bash
./scripts/logs.sh               # всі сервіси
./scripts/logs.sh web           # тільки Django
./scripts/logs.sh frontend      # тільки Vite
./scripts/logs.sh db            # тільки PostgreSQL
./scripts/logs.sh redis         # тільки Redis
./scripts/logs.sh web 100       # останні 100 рядків
```

---

## shell.sh — Консолі

```bash
./scripts/shell.sh              # Django shell (python manage.py shell)
./scripts/shell.sh bash         # bash у web-контейнері
./scripts/shell.sh db           # psql у db-контейнері
./scripts/shell.sh redis        # redis-cli
```

---

## init_env.sh — Генерація .env

Створює `.env` з `.env.example`: генерує випадкові `SECRET_KEY`/`DB_PASSWORD` і підставляє публічний IP сервера в `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS`. Якщо `.env` вже існує — нічого не робить (видали файл вручну, щоб перегенерувати з нуля).

```bash
./scripts/init_env.sh
```

> **Обережно на живому сервері:** якщо Postgres-контейнер вже піднятий з даними, видаляти й перегенеровувати `.env` небезпечно — новий `DB_PASSWORD` не збіжиться з тим, що вже "запечений" у volume бази, і `web` перестане авторизовуватись. Спочатку `./scripts/backup.sh`, або зноси volume разом (`reset.sh`).

---

## deploy.sh — Повністю автоматичний деплой

Ідемпотентний: перший запуск ставить Docker/Compose plugin, налаштовує UFW (SSH + порт 80), генерує `.env` (через `init_env.sh`) і піднімає стек. Кожен наступний запуск — `git pull --ff-only` + rebuild + restart, **не чіпаючи** дані в БД.

```bash
./scripts/deploy.sh                # деплой / оновлення
./scripts/deploy.sh --no-cache     # чистий білд без кешу Docker
```

Розрахований на запуск від root або через sudo на самому VPS (`bash scripts/deploy.sh`). На dev-машині, де Docker вже стоїть, кроки встановлення й UFW просто пропускаються.

> На відміну від `reset.sh`, цей скрипт нічого не видаляє — підходить для щоденного деплою/оновлення.

---

## Типовий workflow

```bash
# Перший запуск
./scripts/init_env.sh
./scripts/deploy.sh
docker compose exec web python manage.py createsuperuser

# Щоденна робота
docker compose up -d            # запустити
./scripts/logs.sh web           # дивитись логи

# Після зміни моделей
./scripts/migrate.sh --make

# Перед небезпечними змінами
./scripts/backup.sh

# Якщо все зламалось
./scripts/restore.sh            # відновити бекап
# або
./scripts/reset.sh --no-cache   # повний скид
```
