#!/bin/bash
# Создаёт самоподписанный сертификат для разработки.
# Домен берётся из .env (SSL_DOMAIN). Для продакшена используйте scripts/letsencrypt.sh.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$ROOT_DIR/ssl"
ENV_FILE="$ROOT_DIR/.env"

mkdir -p "$SSL_DIR"
cd "$ROOT_DIR"

# Домен из .env, без хардкода
CN="localhost"
if [[ -f "$ENV_FILE" ]]; then
  SSL_DOMAIN=$(grep -E '^SSL_DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [[ -n "$SSL_DOMAIN" ]] && CN="$SSL_DOMAIN"
fi

if [[ -f "$SSL_DIR/fullchain.pem" && -f "$SSL_DIR/privkey.pem" ]]; then
  echo "Сертификаты уже есть в $SSL_DIR"
  exit 0
fi

cd "$SSL_DIR"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/CN=${CN}/O=LabWorks/C=RU"

echo "Самоподписанный сертификат создан: $SSL_DIR (CN=$CN)"
echo "Для Let's Encrypt запустите: ./scripts/letsencrypt.sh"
