# SSL / HTTPS (домен из .env, без хардкода)

Домен для сертификата задаётся в `.env`:

- **SSL_DOMAIN** — домен для HTTPS (например `lab.webflare.ru`).
- **LETSENCRYPT_EMAIL** — email для Let's Encrypt (согласие с условиями).

Домен нигде не хардкодится: и самоподписанный сертификат, и Let's Encrypt используют значение из `.env`.

---

## Самоподписанный сертификат (разработка)

Перед первым запуском создайте сертификаты (nginx читает их из `ssl/`):

```bash
./scripts/init-ssl.sh
```

Скрипт возьмёт **SSL_DOMAIN** из `.env` для поля CN. Если **SSL_DOMAIN** не задан, будет использоваться `localhost`.

После этого `docker-compose up` поднимет nginx с HTTPS на 443.

---

## Let's Encrypt (продакшен)

### 1. Настройте .env

В `.env` должны быть заданы:

```bash
SSL_DOMAIN=lab.webflare.ru
LETSENCRYPT_EMAIL=admin@example.com
```

Для продакшена добавьте домен в **ALLOWED_HOSTS** и **CORS_ALLOWED_ORIGINS** (например `https://lab.webflare.ru`).

### 2. Запустите nginx и получите сертификат

```bash
mkdir -p certbot/www
docker-compose up -d nginx
./scripts/letsencrypt.sh
```

Скрипт **letsencrypt.sh** читает **SSL_DOMAIN** и **LETSENCRYPT_EMAIL** из `.env`, получает сертификат для этого домена и копирует его в `ssl/`. Хардкода домена нет.

### 3. Перезагрузите nginx

```bash
docker-compose exec nginx nginx -s reload
```

### 4. Автообновление (cron)

Рекомендуется вызывать обновление по крону; после `certbot renew` нужно снова скопировать сертификаты в `ssl/` и перезагрузить nginx. Можно сделать скрипт, который читает **SSL_DOMAIN** из `.env` и копирует файлы из `/etc/letsencrypt/live/$SSL_DOMAIN/` в `ssl/`, затем выполняет `docker-compose exec nginx nginx -s reload`.

Пример (подставьте путь к проекту):

```bash
# В crontab: ежедневно в 03:00
0 3 * * * cd /path/to/LabWorks && sudo certbot renew --quiet && DOMAIN=$(grep -E '^SSL_DOMAIN=' .env | cut -d= -f2-) && sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/ && sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/ && sudo chown $(whoami) ssl/*.pem && docker-compose exec -T nginx nginx -s reload
```

---

## Кратко

- Домен и email только в `.env`: **SSL_DOMAIN**, **LETSENCRYPT_EMAIL**.
- Самоподписанный сертификат: `./scripts/init-ssl.sh`.
- Let's Encrypt: `./scripts/letsencrypt.sh` (домен и email из `.env`).
- Установка certbot (если нужен): `sudo apt install -y certbot`.
