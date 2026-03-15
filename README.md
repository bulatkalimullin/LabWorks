# FileCompetition

Система сдачи лабораторных работ. Бэкенд: Django + DRF + JWT. Фронтенд: React (Vite) + TypeScript.

## Локальная разработка

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API: `http://127.0.0.1:8000/api/v1/`  
JWT: `POST /api/v1/auth/login/` `{ "username", "password" }`  
Регистрация: `POST /api/v1/auth/register/`

Фронтенд:

```bash
cd frontend && npm install && npm run dev
```

Прокси Vite перенаправляет `/api` на порт 8000.

## Docker Compose (PostgreSQL, Redis, Celery, MinIO, Nginx)

```bash
export DJANGO_SECRET_KEY=your-secret
docker compose up --build
```

- Приложение: `http://localhost` (Nginx → frontend + `/api/` → Django)
- MinIO консоль: `http://localhost:9001` (user/pass в compose)

Включение хранения файлов в MinIO: задать `AWS_*` переменные для сервиса `api` (см. `docker-compose.yml`).

## Масштабирование

См. [docs/SCALING.md](docs/SCALING.md).
