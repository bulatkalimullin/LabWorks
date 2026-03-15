# Горизонтальное масштабирование

## API (несколько воркеров Gunicorn)

В `docker-compose.yml` сервис `api` уже использует Gunicorn с `--workers 2`. Увеличьте `--workers` или запустите несколько реплик:

```bash
docker compose up -d --scale api=3
```

Для балансировки между несколькими контейнерами `api` замените в `nginx/nginx.conf` блок `upstream api_backend` на явный список или используйте внешний load balancer (Traefik, cloud LB).

## Celery

```bash
docker compose up -d --scale celery=2
```

Очередь Redis распределит задачи между воркерами.

## PostgreSQL

- **Read replicas**: настройте реплику и в Django — роутер БД для read-only запросов.
- **PgBouncer**: поставьте перед Postgres и укажите `HOST`/`PORT` пула в `POSTGRES_HOST`.

## Redis HA

Redis Sentinel или Redis Cluster для отказоустойчивости брокера и кэша.

## Файлы

При включённом S3/MinIO (`AWS_STORAGE_BUCKET_NAME`) файлы не привязаны к локальной ФС — можно масштабировать API без общего volume.
