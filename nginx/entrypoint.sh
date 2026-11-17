#!/bin/sh
set -e

CERT_DIR="/etc/letsencrypt/live/saidloop.com"
mkdir -p /var/www/certbot

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
    echo "Generating temporary self-signed certificate for saidloop.com..."
    apk add --no-cache openssl >/dev/null 2>&1 || true
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=saidloop.com"
    touch "$CERT_DIR/.selfsigned"
fi

# Background loop to reload nginx when certbot updates certs
(
    while :; do
        sleep 60
        if [ -f "/etc/letsencrypt/.reload_nginx" ]; then
            rm -f /etc/letsencrypt/.reload_nginx
            nginx -s reload
        fi
    done
) &

exec nginx -g "daemon off;"
