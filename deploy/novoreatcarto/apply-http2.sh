#!/usr/bin/env bash
# Put nginx HTTP/2+TLS on public 8090/8443; Apache stays localhost :8091 for PHP.
# NEVER binds :80/:443 and never touches /var/www/reatcarto.furg.br.
set -euo pipefail

PROTECTED_DIR='/var/www/reatcarto.furg.br'
APP_DIR='/var/www/novoreatcarto'
ENV_FILE="${APP_DIR}/.env"
SITE_CONF='/etc/apache2/sites-available/novoreatcarto.conf'
APP_INC='/etc/apache2/sites-available/novoreatcarto-app.inc'
NGINX_SITE='/etc/nginx/sites-available/novoreatcarto'
HTTPS_URL='https://reatcarto.furg.br:8090'

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo bash apply-http2.sh)" >&2
  exit 1
fi

if [[ -e "$PROTECTED_DIR" ]]; then
  echo "Protected site present (will not modify): $PROTECTED_DIR"
fi

echo "==> Install nginx if needed (will not take :80/:443)"
export DEBIAN_FRONTEND=noninteractive
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y nginx
fi

echo "==> Disable nginx default site so :80 stays with Apache/reatcarto.furg.br"
rm -f /etc/nginx/sites-enabled/default
if grep -qE 'listen 80' /etc/nginx/sites-enabled/* 2>/dev/null; then
  echo "Refusing: an nginx site still listens on :80" >&2
  exit 1
fi

echo "==> Build TLS fullchain for nginx"
mkdir -p "${APP_DIR}/ssl"
PROTECTED_VHOST='/etc/apache2/sites-available/reatcarto.furg.br.conf'
SSL_CERT="$(awk '/SSLCertificateFile/{print $2; exit}' "$PROTECTED_VHOST")"
SSL_KEY="$(awk '/SSLCertificateKeyFile/{print $2; exit}' "$PROTECTED_VHOST")"
SSL_CHAIN="$(awk '/SSLCertificateChainFile/{print $2; exit}' "$PROTECTED_VHOST")"
if [[ -z "${SSL_CERT:-}" || -z "${SSL_KEY:-}" || ! -f "$SSL_CERT" || ! -f "$SSL_KEY" ]]; then
  echo "Could not read institutional certificate paths" >&2
  exit 1
fi
if [[ -n "${SSL_CHAIN:-}" && -f "$SSL_CHAIN" ]]; then
  cat "$SSL_CERT" "$SSL_CHAIN" > "${APP_DIR}/ssl/fullchain.pem"
else
  cp -a "$SSL_CERT" "${APP_DIR}/ssl/fullchain.pem"
fi
chmod 640 "${APP_DIR}/ssl/fullchain.pem"
chown root:www-data "${APP_DIR}/ssl/fullchain.pem" || true

echo "==> Install nginx + Apache backend configs"
install -m 644 /tmp/novoreatcarto-nginx.conf "$NGINX_SITE"
sed -i "s|ssl_certificate_key .*|ssl_certificate_key ${SSL_KEY};|" "$NGINX_SITE"
ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/novoreatcarto

if [[ -f /tmp/novoreatcarto-app.inc ]]; then
  install -m 644 /tmp/novoreatcarto-app.inc "$APP_INC"
fi
install -m 644 /tmp/novoreatcarto-apache-backend.conf "$SITE_CONF"

echo "==> Update CORS / APP_BASE_URL"
if [[ -f "$ENV_FILE" ]]; then
  umask 077
  tmp_env="$(mktemp)"
  grep -vE '^(APP_BASE_URL|CORS_ALLOWED_ORIGINS)=' "$ENV_FILE" > "$tmp_env"
  cat >> "$tmp_env" <<EOF
APP_BASE_URL=${HTTPS_URL}
CORS_ALLOWED_ORIGINS=${HTTPS_URL},https://reatcarto.furg.br:8443,https://200.132.255.26:8090,https://200.132.255.26:8443,http://127.0.0.1:8091
EOF
  cat "$tmp_env" > "$ENV_FILE"
  rm -f "$tmp_env"
  chmod 640 "$ENV_FILE"
  chown root:www-data "$ENV_FILE" 2>/dev/null || true
fi

echo "==> Precompress static text assets"
find "${APP_DIR}/dist" \( -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.svg' -o -name '*.html' \) -print0 \
  | xargs -0 -r -n 1 -P 2 gzip -kf -9 || true

echo "==> Configtest"
nginx -t
apache2ctl configtest

echo "==> Reload Apache (localhost :8091) then nginx (public :8090/:8443)"
systemctl reload apache2 || systemctl restart apache2
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
  ufw allow 8090/tcp comment 'novoreatcarto https http2' || true
  ufw allow 8443/tcp comment 'novoreatcarto https http2 alt' || true
fi

echo "==> Done"
echo "HTTPS (use this from outside): ${HTTPS_URL}"
echo "HTTPS alt: https://reatcarto.furg.br:8443"
echo "Protected site untouched: $PROTECTED_DIR"
echo "Apache PHP backend: 127.0.0.1:8091"
