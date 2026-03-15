#!/bin/bash
# Получает сертификат Let's Encrypt для домена из .env (SSL_DOMAIN) и кладёт в ssl/.
# Требует: certbot, запущенный nginx с certbot/www для ACME challenge.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
SSL_DIR="$ROOT_DIR/ssl"
CERTBOT_WWW="$ROOT_DIR/certbot/www"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Файл .env не найден. Создайте его из .env.example и задайте SSL_DOMAIN и LETSENCRYPT_EMAIL." >&2
  exit 1
fi

SSL_DOMAIN=$(grep -E '^SSL_DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
LETSENCRYPT_EMAIL=$(grep -E '^LETSENCRYPT_EMAIL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [[ -z "$SSL_DOMAIN" ]]; then
  echo "В .env не задан SSL_DOMAIN. Добавьте, например: SSL_DOMAIN=lab.webflare.ru" >&2
  exit 1
fi

if [[ -z "$LETSENCRYPT_EMAIL" ]]; then
  echo "В .env не задан LETSENCRYPT_EMAIL (нужен для Let's Encrypt). Добавьте, например: LETSENCRYPT_EMAIL=admin@example.com" >&2
  exit 1
fi

mkdir -p "$CERTBOT_WWW"
mkdir -p "$SSL_DIR"

echo "Домен из .env: $SSL_DOMAIN"
echo "Получение сертификата Let's Encrypt..."

sudo certbot certonly --webroot \
  -w "$CERTBOT_WWW" \
  -d "$SSL_DOMAIN" \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

LE_DIR="/etc/letsencrypt/live/$SSL_DOMAIN"
if [[ ! -d "$LE_DIR" ]]; then
  echo "Ожидалась директория $LE_DIR" >&2
  exit 1
fi

echo "Копирование сертификатов в $SSL_DIR ..."
sudo cp "$LE_DIR/fullchain.pem" "$SSL_DIR/fullchain.pem"
sudo cp "$LE_DIR/privkey.pem" "$SSL_DIR/privkey.pem"
sudo chown "$(whoami)" "$SSL_DIR/fullchain.pem" "$SSL_DIR/privkey.pem"

echo "Готово. Перезагрузите nginx: docker-compose exec nginx nginx -s reload"
