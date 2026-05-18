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

## Типовий workflow

```bash
# Перший запуск
./scripts/reset.sh
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
