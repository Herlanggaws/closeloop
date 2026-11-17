#!/usr/bin/env bash
set -euo pipefail

DOMAINS="-d saidloop.com -d api.saidloop.com"
EMAIL="${LETSENCRYPT_EMAIL:-admin@saidloop.com}"

echo "Requesting Let's Encrypt certificate for saidloop.com and api.saidloop.com..."
docker compose exec -T certbot sh -c "
  rm -rf /etc/letsencrypt/live/saidloop.com /etc/letsencrypt/archive/saidloop.com /etc/letsencrypt/renewal/saidloop.com.conf &&
  certbot certonly --webroot -w /var/www/certbot \
    --email \"$EMAIL\" \
    $DOMAINS \
    --rsa-key-size 4096 \
    --agree-tos \
    --non-interactive \
    --force-renewal &&
  touch /etc/letsencrypt/.reload_nginx
"
docker compose exec -T nginx nginx -s reload
echo "SSL certificate successfully installed and Nginx reloaded!"
