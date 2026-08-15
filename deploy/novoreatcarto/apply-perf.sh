#!/usr/bin/env bash
# Apply HTTPS/HTTP/2, compression and cache headers for isolated novoreatcarto.
# NEVER touches /var/www/reatcarto.furg.br or its vhost files.
set -euo pipefail

PROTECTED_DIR='/var/www/reatcarto.furg.br'
APP_DIR='/var/www/novoreatcarto'
ENV_FILE="${APP_DIR}/.env"
SITE_CONF='/etc/apache2/sites-available/novoreatcarto.conf'
APP_INC='/etc/apache2/sites-available/novoreatcarto-app.inc'
HTTPS_PORT='8443'
HTTP_PORT='8090'

refuse_protected() {
  local path="$1"
  if [[ "$path" == *'reatcarto.furg.br'* && "$path" != *'.conf' && "$path" != *'.inc' ]]; then
    echo "Refusing to touch protected path: $path" >&2
    exit 1
  fi
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo bash apply-perf.sh)" >&2
  exit 1
fi

refuse_protected "$APP_DIR"
if [[ ! -d "$APP_DIR/dist" ]]; then
  echo "App dist not found: $APP_DIR/dist" >&2
  exit 1
fi

echo "==> Enable Apache modules (isolated site only)"
a2enmod alias rewrite ssl http2 headers expires deflate filter >/dev/null
a2enmod brotli >/dev/null 2>&1 || echo "mod_brotli unavailable; gzip still enabled"

if [[ -f /tmp/novoreatcarto-app.inc ]]; then
  install -m 644 /tmp/novoreatcarto-app.inc "$APP_INC"
fi
if [[ -f /tmp/novoreatcarto-apache.conf ]]; then
  install -m 644 /tmp/novoreatcarto-apache.conf "$SITE_CONF"
fi

PROTECTED_VHOST='/etc/apache2/sites-available/reatcarto.furg.br.conf'
if [[ -f "$PROTECTED_VHOST" ]]; then
  SSL_CERT="$(awk '/SSLCertificateFile/{print $2; exit}' "$PROTECTED_VHOST")"
  SSL_KEY="$(awk '/SSLCertificateKeyFile/{print $2; exit}' "$PROTECTED_VHOST")"
  SSL_CHAIN="$(awk '/SSLCertificateChainFile/{print $2; exit}' "$PROTECTED_VHOST")"
  if [[ -n "${SSL_CERT:-}" && -n "${SSL_KEY:-}" && -f "$SSL_CERT" && -f "$SSL_KEY" ]]; then
    echo "==> Reusing institutional certificate (read-only) for :${HTTPS_PORT}"
    sed -i "s|^    SSLCertificateFile .*|    SSLCertificateFile ${SSL_CERT}|" "$SITE_CONF"
    sed -i "s|^    SSLCertificateKeyFile .*|    SSLCertificateKeyFile ${SSL_KEY}|" "$SITE_CONF"
    if [[ -n "${SSL_CHAIN:-}" && -f "$SSL_CHAIN" ]]; then
      sed -i "s|^    SSLCertificateChainFile .*|    SSLCertificateChainFile ${SSL_CHAIN}|" "$SITE_CONF"
    fi
  fi
fi

echo "==> Update CORS / APP_BASE_URL for HTTP and HTTPS"
HTTPS_URL="https://reatcarto.furg.br:${HTTPS_PORT}"
HTTP_URL="http://200.132.255.26:${HTTP_PORT}"
IP_HTTPS_URL="https://200.132.255.26:${HTTPS_PORT}"
if [[ -f "$ENV_FILE" ]]; then
  umask 077
  tmp_env="$(mktemp)"
  grep -vE '^(APP_BASE_URL|CORS_ALLOWED_ORIGINS)=' "$ENV_FILE" > "$tmp_env"
  cat >> "$tmp_env" <<EOF
APP_BASE_URL=${HTTPS_URL}
CORS_ALLOWED_ORIGINS=${HTTPS_URL},${HTTP_URL},${IP_HTTPS_URL},http://127.0.0.1:${HTTP_PORT},http://localhost:${HTTP_PORT}
EOF
  cat "$tmp_env" > "$ENV_FILE"
  rm -f "$tmp_env"
  chmod 640 "$ENV_FILE"
  chown root:www-data "$ENV_FILE" 2>/dev/null || chown root:apache "$ENV_FILE" || true
fi

a2ensite novoreatcarto.conf >/dev/null
apache2ctl configtest
systemctl reload apache2 || systemctl restart apache2

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
  ufw allow "${HTTPS_PORT}/tcp" comment 'novoreatcarto isolated https' || true
fi

echo "==> Done"
echo "HTTP:  ${HTTP_URL}"
echo "HTTPS: ${HTTPS_URL}"
echo "Protected site untouched: $PROTECTED_DIR"
