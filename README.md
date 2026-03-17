# LabWorks

[![CI](https://github.com/bulatkalimullin/LabWorks/actions/workflows/ci.yml/badge.svg)](https://github.com/bulatkalimullin/LabWorks/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.11-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/django-5.2-092E20?logo=django&logoColor=white)
![React](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/typescript-5.9-3178C6?logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)

Система сдачи лабораторных работ с поведенческой аналитикой (anti-GPT мониторинг).

## Стек

| Слой | Технологии |
|---|---|
| Backend | Django 5.2 · DRF · SimpleJWT · Celery · pyotp |
| Frontend | React 19 · TypeScript · Vite · React Router |
| Хранилище | PostgreSQL 16 · Redis 7 · MinIO (S3) |
| Инфраструктура | Docker Compose · Nginx · SSL/HTTPS |

## Быстрый старт (локально)

```bash
# Backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

```bash
# Frontend
cd frontend && npm install && npm run dev
```

API: `http://127.0.0.1:8000/api/v1/`
Vite проксирует `/api` на порт 8000.

## Docker Compose

```bash
cp .env.example .env        # заполнить переменные
docker compose up --build
```

- Приложение: `https://localhost` (Nginx → frontend + `/api/` → Django)
- MinIO консоль: `http://localhost:9001`

Для хранения файлов в MinIO задать `AWS_*` переменные в `.env` (см. `docker-compose.yml`).

## Тесты

```bash
pip install -r requirements-test.txt
pytest apps/laboratory/tests.py -v
```

Тесты используют SQLite (Postgres не нужен). Покрытие: аутентификация, курсы, задания, сдачи, поведенческая аналитика.

## CI/CD

**CI** запускается автоматически на каждый push и PR в `master`:
- Backend: pytest (23 теста)
- Frontend: ESLint + TypeScript type-check

**CD** запускается после успешного CI. Для подключения добавить секреты в **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Описание |
|---|---|
| `SSH_HOST` | IP или домен сервера |
| `SSH_USER` | SSH пользователь |
| `SSH_PRIVATE_KEY` | Приватный SSH ключ |
| `SSH_PORT` | SSH порт (обычно `22`) |
| `DEPLOY_PATH` | Путь к проекту на сервере |

После добавления секретов CD будет делать `git pull` + `docker compose up --build` автоматически.

## Переменные окружения

| Переменная | Обязательная | Описание |
|---|---|---|
| `DJANGO_SECRET_KEY` | Да | Секретный ключ Django |
| `POSTGRES_DB` | Да | Имя БД |
| `POSTGRES_USER` | Да | Пользователь БД |
| `POSTGRES_PASSWORD` | Да | Пароль БД |
| `POSTGRES_HOST` | Нет | Хост БД (без него — SQLite) |
| `REDIS_URL` | Нет | URL Redis для кэша |
| `ALLOWED_HOSTS` | Нет | Разрешённые хосты через запятую |
| `SSL_DOMAIN` | Нет | Домен для HTTPS |
| `AWS_*` | Нет | S3/MinIO настройки |
| `DEBUG` | Нет | `true` для режима отладки |

Полный список см. в `.env.example`.
