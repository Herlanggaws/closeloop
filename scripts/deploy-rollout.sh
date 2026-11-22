#!/usr/bin/env bash
set -euo pipefail

# Ensure database is up and pull latest application images while existing containers serve traffic
docker compose up -d db
docker compose pull backend frontend

rollout_service() {
  local svc="$1"
  local old_ids
  old_ids=$(docker compose ps -q "$svc" || true)

  if [ -z "$old_ids" ]; then
    echo "Starting $svc container..."
    docker compose up -d --no-deps "$svc"
  else
    echo "Scaling up new $svc container alongside existing instance..."
    if ! docker compose up -d --no-deps --scale "$svc=2" --no-recreate "$svc"; then
      echo "Fallback: recreating $svc container directly..."
      docker compose up -d --no-deps --force-recreate "$svc"
      old_ids=""
    fi
  fi

  local new_id=""
  for id in $(docker compose ps -q "$svc"); do
    if [ -z "$old_ids" ] || ! echo "$old_ids" | grep -q "$id"; then
      new_id="$id"
      break
    fi
  done
  if [ -z "$new_id" ]; then
    new_id=$(docker compose ps -q "$svc" | head -n 1)
  fi

  echo "Waiting for new $svc container ($new_id) to become healthy..."
  local healthy=0
  for _ in $(seq 1 45); do
    local status
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$new_id" 2>/dev/null || echo "starting")
    if [ "$status" = "healthy" ]; then
      healthy=1
      break
    fi
    sleep 2
  done

  if [ "$healthy" -ne 1 ]; then
    echo "New $svc container ($new_id) failed healthcheck; aborting rollout!" >&2
    docker logs --tail=50 "$new_id" || true
    if [ -n "$old_ids" ] && ! echo "$old_ids" | grep -q "$new_id"; then
      docker rm -f "$new_id" || true
    fi
    return 1
  fi

  docker compose up -d --no-deps nginx certbot
  docker compose exec -T nginx nginx -s reload || true

  if [ -n "$old_ids" ]; then
    for old_id in $old_ids; do
      if [ "$old_id" != "$new_id" ]; then
        echo "Draining and stopping old $svc container ($old_id)..."
        docker stop -t 15 "$old_id" || true
        docker rm -f "$old_id" || true
      fi
    done
    docker compose up -d --no-deps --scale "$svc=1" --no-recreate "$svc"
    docker compose exec -T nginx nginx -s reload || true
  fi

  echo "$svc rolled out with zero downtime!"
}

rollout_service backend
rollout_service frontend

docker image prune -f
docker compose ps
