#!/usr/bin/env bash
# Publish novoreatcarto on :80/:443 for IP 200.132.255.26 (old maress role).
# NEVER modifies reatcarto.furg.br vhost files or DocumentRoot.
set -euo pipefail

PROTECTED_DIR='/var/www/reatcarto.furg.br'
PROTECTED_VHOST='/etc/apache2/sites-available/reatcarto.furg.br.conf'
APP_DIR='/var/www/novoreatcarto'
ENV_FILE="${APP_DIR}/.env"
IP_SITE='000-novoreatcarto-ip.conf'
IP_CONF="/etc/apache2/sites-available/${IP_SITE}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo bash apply-ip80.sh)" >&2
  exit 1
fi

if [[ ! -d "$PROTECTED_DIR" ]]; then
  echo "Protected dir missing; aborting" >&2
  exit 1
fi
if [[ ! -d "$APP_DIR/dist" ]]; then
  echo "App dist missing: $APP_DIR/dist" >&2
  exit 1
fi

echo "==> Safety: will not edit $PROTECTED_VHOST"
cp -a "$PROTECTED_VHOST" /tmp/reatcarto.furg.br.conf.sha
sha_before="$(sha256sum "$PROTECTED_VHOST" | awk '{print $1}')"

if [[ -f /tmp/novoreatcarto-app.inc ]]; then
  install -m 644 /tmp/novoreatcarto-app.inc /etc/apache2/sites-available/novoreatcarto-app.inc
fi
install -m 644 /tmp/novoreatcarto-ip.conf "$IP_CONF"

SSL_CERT="$(awk '/SSLCertificateFile/{print $2; exit}' "$PROTECTED_VHOST")"
SSL_KEY="$(awk '/SSLCertificateKeyFile/{print $2; exit}' "$PROTECTED_VHOST")"
SSL_CHAIN="$(awk '/SSLCertificateChainFile/{print $2; exit}' "$PROTECTED_VHOST")"
if [[ -n "${SSL_CERT:-}" && -n "${SSL_KEY:-}" ]]; then
  sed -i "s|^    SSLCertificateFile .*|    SSLCertificateFile ${SSL_CERT}|" "$IP_CONF"
  sed -i "s|^    SSLCertificateKeyFile .*|    SSLCertificateKeyFile ${SSL_KEY}|" "$IP_CONF"
  if [[ -n "${SSL_CHAIN:-}" ]]; then
    sed -i "s|^    SSLCertificateChainFile .*|    SSLCertificateChainFile ${SSL_CHAIN}|" "$IP_CONF"
  fi
fi

a2ensite "$IP_SITE" >/dev/null

echo "==> Update CORS for IP :80/:443"
if [[ -f "$ENV_FILE" ]]; then
  umask 077
  tmp_env="$(mktemp)"
  grep -vE '^(APP_BASE_URL|CORS_ALLOWED_ORIGINS)=' "$ENV_FILE" > "$tmp_env"
  cat >> "$tmp_env" <<'EOF'
APP_BASE_URL=http://200.132.255.26
CORS_ALLOWED_ORIGINS=http://200.132.255.26,https://200.132.255.26,http://200.132.255.26:8090,https://200.132.255.26:8443,https://reatcarto.furg.br,https://reatcarto.furg.br:8443,http://127.0.0.1:8090
EOF
  cat "$tmp_env" > "$ENV_FILE"
  rm -f "$tmp_env"
  chmod 640 "$ENV_FILE"
  chown root:www-data "$ENV_FILE" 2>/dev/null || true
fi

echo "==> Apache configtest"
if ! apache2ctl configtest; then
  a2dissite "$IP_SITE" >/dev/null || true
  echo "Configtest failed; new IP site disabled. Protected vhost unchanged." >&2
  exit 1
fi

systemctl reload apache2

sha_after="$(sha256sum "$PROTECTED_VHOST" | awk '{print $1}')"
if [[ "$sha_before" != "$sha_after" ]]; then
  echo "Protected vhost changed unexpectedly; restoring" >&2
  cp -a /tmp/reatcarto.furg.br.conf.sha "$PROTECTED_VHOST"
  systemctl reload apache2
  exit 1
fi

echo "==> Done"
echo "New app (like old maress): http://200.132.255.26/"
echo "New app HTTPS:             https://200.132.255.26/"
echo "Old site untouched:        https://reatcarto.furg.br/"
echo "Protected vhost sha256:    $sha_after"
