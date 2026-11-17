#!/bin/sh
DOMAIN="saidloop.com"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
EMAIL="${LETSENCRYPT_EMAIL:-admin@saidloop.com}"

trap exit TERM
sleep 5

while :; do
    if [ -f "$CERT_DIR/.selfsigned" ] || [ ! -f "$CERT_DIR/fullchain.pem" ]; then
        echo "[certbot] Attempting to obtain Let's Encrypt certificate for saidloop.com and api.saidloop.com..."
        rm -rf /tmp/cert-backup
        if [ -d "$CERT_DIR" ]; then
            cp -r "$CERT_DIR" /tmp/cert-backup
            rm -rf "$CERT_DIR" "/etc/letsencrypt/archive/$DOMAIN" "/etc/letsencrypt/renewal/$DOMAIN.conf"
        fi

        if certbot certonly --webroot -w /var/www/certbot \
            --email "$EMAIL" \
            -d saidloop.com -d api.saidloop.com \
            --rsa-key-size 4096 \
            --agree-tos \
            --non-interactive; then
            echo "[certbot] Certificate obtained successfully!"
            rm -rf /tmp/cert-backup
            touch /etc/letsencrypt/.reload_nginx
        else
            echo "[certbot] Could not obtain certificate yet (verify DNS A records for saidloop.com & api.saidloop.com point to 103.174.114.154). Retrying in 5m..."
            if [ -d /tmp/cert-backup ]; then
                mkdir -p "/etc/letsencrypt/live"
                mv /tmp/cert-backup "$CERT_DIR"
            fi
            sleep 300
            continue
        fi
    else
        certbot renew --webroot -w /var/www/certbot --deploy-hook "touch /etc/letsencrypt/.reload_nginx"
    fi
    sleep 12h & wait $!
done
