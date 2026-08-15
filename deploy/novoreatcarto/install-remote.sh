#!/usr/bin/env bash
# Installs isolated novoreatcarto under /var/www/novoreatcarto.
# NEVER touches /var/www/reatcarto.furg.br or its vhost.
set -euo pipefail

PROTECTED_DIR='/var/www/reatcarto.furg.br'
APP_TMP='/var/www/maress'
APP_DIR='/var/www/novoreatcarto'
DB_NAME='novoreatcarto'
DB_USER='novoreatcarto'
HTTP_PORT='8090'
ENV_FILE="${APP_DIR}/.env"
CRED_FILE="${APP_DIR}/.deploy-credentials"

refuse_protected() {
  local path="$1"
  if [[ "$path" == *'reatcarto.furg.br'* ]]; then
    echo "Refusing to touch protected path: $path" >&2
    exit 1
  fi
}

echo "==> Safety checks"
if [[ -e "$PROTECTED_DIR" ]]; then
  echo "Protected site present (will not modify): $PROTECTED_DIR"
fi
refuse_protected "$APP_TMP"
refuse_protected "$APP_DIR"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo bash install-remote.sh)" >&2
  exit 1
fi

echo "==> Detect web stack"
WEB_STACK=''
if [[ -d /etc/apache2 ]]; then
  WEB_STACK='apache'
elif [[ -d /etc/nginx ]]; then
  WEB_STACK='nginx'
else
  echo "Neither Apache nor Nginx found." >&2
  exit 1
fi
echo "Web stack: $WEB_STACK"

PHP_BIN="$(command -v php || true)"
if [[ -z "$PHP_BIN" ]]; then
  echo "php CLI not found." >&2
  exit 1
fi
echo "PHP: $("$PHP_BIN" -v | head -n 1)"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found." >&2
  exit 1
fi

echo "==> Prepare app directories (maress -> novoreatcarto)"
mkdir -p /var/www
if [[ -d "$APP_DIR" && -d "$APP_TMP" && "$APP_DIR" -ef "$APP_TMP" ]]; then
  echo "maress and novoreatcarto already the same directory"
elif [[ -d "$APP_DIR" ]]; then
  echo "Using existing $APP_DIR"
  if [[ -e "$APP_TMP" && ! "$APP_TMP" -ef "$APP_DIR" ]]; then
    echo "Note: $APP_TMP also exists; project will live in $APP_DIR"
  fi
elif [[ -d "$APP_TMP" ]]; then
  mv "$APP_TMP" "$APP_DIR"
  echo "Renamed $APP_TMP -> $APP_DIR"
else
  mkdir -p "$APP_TMP"
  mv "$APP_TMP" "$APP_DIR"
  echo "Created $APP_DIR (via maress rename)"
fi

ARCHIVE="${1:-/tmp/novoreatcarto.tar.gz}"
if [[ ! -f "$ARCHIVE" ]]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi

echo "==> Unpack project into $APP_DIR"
# Keep .env if we reinstall
if [[ -f "$ENV_FILE" ]]; then
  cp -a "$ENV_FILE" /tmp/novoreatcarto.env.bak
fi
tar -xzf "$ARCHIVE" -C "$APP_DIR"
if [[ -f /tmp/novoreatcarto.env.bak && ! -f "$ENV_FILE" ]]; then
  mv /tmp/novoreatcarto.env.bak "$ENV_FILE"
fi
mkdir -p "$APP_DIR/uploads" "$APP_DIR/php/icons/uploads"

echo "==> Create isolated Postgres database (idempotent)"
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 18)"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS postgis;
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
SQL

echo "==> Write isolated .env"
APP_BASE_URL="http://$(hostname -I | awk '{print $1}'):${HTTP_PORT}"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
SESSION_SECURE=false
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=Lax
SESSION_NAME=NOVOREATCARTO_SESSID
APP_BASE_URL=${APP_BASE_URL}
CORS_ALLOWED_ORIGINS=${APP_BASE_URL},http://127.0.0.1:${HTTP_PORT},http://localhost:${HTTP_PORT},http://200.132.255.26:${HTTP_PORT},https://reatcarto.furg.br:8443,https://200.132.255.26:8443
REQUIRE_EMAIL_VERIFICATION=false
ADMIN_EMAIL=admin@novoreatcarto.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASS}
TERMS_VERSION=1.0.0
PRIVACY_VERSION=1.0.0
UPLOADS_ROOT=${APP_DIR}/uploads
EOF
  umask 077
  cat > "$CRED_FILE" <<EOF
url=${APP_BASE_URL}
admin_user=admin
admin_password=${ADMIN_PASS}
database=${DB_NAME}
db_user=${DB_USER}
EOF
else
  echo "Keeping existing $ENV_FILE"
fi
chmod 640 "$ENV_FILE"
chown root:www-data "$ENV_FILE" 2>/dev/null || chown root:apache "$ENV_FILE" || true

echo "==> Permissions"
WEB_USER='www-data'
id "$WEB_USER" >/dev/null 2>&1 || WEB_USER='apache'
chown -R reatadm:"$WEB_USER" "$APP_DIR"
chmod -R u+rwX,g+rX,o-rwx "$APP_DIR"
chmod -R g+rwX "$APP_DIR/uploads" "$APP_DIR/php/icons/uploads"
# Apache (www-data) needs group execute on dirs; a 700 dist/assets yields 403 and a white login.
chmod -R g+rX "$APP_DIR/dist" "$APP_DIR/php"
find "$APP_DIR" -type d -exec chmod g+rx,g+s {} \;

echo "==> Migrate and seed (isolated DB only)"
cd "$APP_DIR"
sudo -u "$WEB_USER" "$PHP_BIN" php/bin/migrate.php
sudo -u "$WEB_USER" "$PHP_BIN" php/bin/seed_admin.php

echo "==> Configure $WEB_STACK on port ${HTTP_PORT} (isolated)"
if [[ "$WEB_STACK" == apache ]]; then
  install -m 644 /tmp/novoreatcarto-app.inc /etc/apache2/sites-available/novoreatcarto-app.inc
  install -m 644 /tmp/novoreatcarto-apache.conf /etc/apache2/sites-available/novoreatcarto.conf
  a2enmod alias rewrite ssl http2 headers expires deflate filter >/dev/null 2>&1 || true
  a2enmod brotli >/dev/null 2>&1 || true
  a2ensite novoreatcarto.conf
  if [[ -L /etc/apache2/sites-enabled/maress.conf || -f /etc/apache2/sites-enabled/maress.conf ]]; then
    a2dissite maress.conf || true
    echo "Disabled placeholder maress.conf on :80 (reatcarto.furg.br untouched)"
  fi
  apache2ctl configtest
  systemctl enable apache2
  systemctl reload apache2 || systemctl restart apache2
else
  PHP_SOCK=''
  for sock in /run/php/php-fpm.sock /run/php/php8.3-fpm.sock /run/php/php8.2-fpm.sock /run/php/php8.1-fpm.sock; do
    if [[ -S "$sock" ]]; then PHP_SOCK="$sock"; break; fi
  done
  if [[ -z "$PHP_SOCK" ]]; then
    echo "php-fpm socket not found" >&2
    exit 1
  fi
  sed "s|unix:/run/php/php-fpm.sock|unix:${PHP_SOCK}|" /tmp/novoreatcarto-nginx.conf \
    > /etc/nginx/sites-available/novoreatcarto
  ln -sfn /etc/nginx/sites-available/novoreatcarto /etc/nginx/sites-enabled/novoreatcarto
  nginx -t
  systemctl enable nginx
  systemctl enable php*-fpm 2>/dev/null || true
  systemctl reload nginx
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
  ufw allow "${HTTP_PORT}/tcp" comment 'novoreatcarto isolated http' || true
  ufw allow 8443/tcp comment 'novoreatcarto isolated https' || true
fi

echo "==> Done"
echo "App dir: $APP_DIR"
echo "HTTP: http://200.132.255.26:${HTTP_PORT}"
echo "HTTPS: https://reatcarto.furg.br:8443"
echo "Protected site untouched: $PROTECTED_DIR"
if [[ -f "$CRED_FILE" ]]; then
  echo "Admin credentials: $CRED_FILE"
fi
