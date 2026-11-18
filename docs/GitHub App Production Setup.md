# GitHub App — Production Setup (Saidloop)

Ops guide to fix **“GitHub App is not configured on server”** (HTTP **503** on Connect) at `https://saidloop.com/app/settings/integrations`.

Symptom in DevTools: `GET …/integrations/github/install?project_id=…` → **503**.

---

## Root cause

Backend builds a GitHub App client from env. If `GITHUB_APP_ID` or the private key is missing/unreadable, install returns 503 `NOT_CONFIGURED`.

Production runs via Docker Compose on the VM (`/home/xerv/closeloop`). The backend container loads:

- `./project/.env` (optional)
- `./project/backend/.env` (optional)

There is **no** volume mount for a `.pem` file. Prefer **inline** `GITHUB_APP_PRIVATE_KEY`. Do **not** rely on `GITHUB_APP_PRIVATE_KEY_PATH` pointing at a host path unless you also mount that file into the container.

---

## Prerequisites

- SSH access to the production VM
- Access to the GitHub App **saidloop-auto-pr** (or your App’s settings)
- Values (never commit these):
  - App ID
  - Client ID
  - Webhook secret
  - Private key PEM

Local engineers may already have these in a non-committed `project/.env` + PEM under `project/backend/.secrets/` — copy values to prod securely (1Password, sealed note, etc.), do not paste into Slack/git.

---

## 1. Confirm GitHub App settings

Open: GitHub → **Settings → Developer settings → GitHub Apps →** your app (slug default: `saidloop-auto-pr`).

| Field | Production value |
| --- | --- |
| **Webhook URL** | `https://api.saidloop.com/webhooks/github` |
| **Webhook secret** | Same string as `GITHUB_APP_WEBHOOK_SECRET` on the server |
| **Setup URL** (after install) | `https://api.saidloop.com/api/integrations/github/callback` |
| **Callback / redirect** (if asked) | Same setup URL as above |
| **Slug** | Must match `GITHUB_APP_SLUG` (default `saidloop-auto-pr`) |

Recommended permissions (minimum for Issues + Auto PR):

- Repository: **Contents** read/write, **Pull requests** write, **Issues** write, **Metadata** read
- Subscribe to events: at least **Installation**, **Installation repositories**, **Pull request** (and Issues if you rely on issue webhooks later)

“Where can this App be installed?” — usually **Any account** for SaaS customers.

---

## 2. Set env on the VM

```bash
ssh <user>@<prod-host>
cd /home/xerv/closeloop
```

Edit **`project/.env`** (preferred; Compose already loads it) **or** `project/backend/.env`.

Add / update (replace placeholders; keep quotes around the PEM):

```bash
# Required for Connect / Issues / Auto PR
GITHUB_APP_ID=<numeric App ID>
GITHUB_APP_CLIENT_ID=<Iv… Client ID>
GITHUB_APP_SLUG=saidloop-auto-pr
GITHUB_APP_WEBHOOK_SECRET=<webhook secret from App settings>

# Prefer inline PEM inside Docker (recommended)
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...full PEM body...
-----END RSA PRIVATE KEY-----"

# Optional: only if you mount the file into the container
# GITHUB_APP_PRIVATE_KEY_PATH=/secrets/saidloop-auto-pr.private-key.pem
```

Also ensure API/web URLs are production (used for redirects / cookies flows):

```bash
API_URL=https://api.saidloop.com
WEB_URL=https://saidloop.com
```

**Checklist**

- [ ] File is on the VM only (not committed; deploy uses `git reset --hard` but untracked `.env` should remain)
- [ ] PEM uses real newlines inside the quoted block (or `\n` escapes if your loader expects that — current Go `godotenv` + Compose prefer real multiline in the file)
- [ ] No trailing spaces on `GITHUB_APP_ID`
- [ ] Webhook secret matches GitHub App settings exactly

---

## 3. Recreate the backend container

Env is read at process start; recreate so the new values load:

```bash
cd /home/xerv/closeloop
docker compose up -d --force-recreate backend
docker compose ps backend
docker compose logs --tail=80 backend
```

Health:

```bash
curl -sf https://api.saidloop.com/healthz && echo OK
```

**Verify env is set inside the container** (names only — do not print secret values):

```bash
docker compose exec backend sh -c '
  for k in GITHUB_APP_ID GITHUB_APP_CLIENT_ID GITHUB_APP_SLUG GITHUB_APP_WEBHOOK_SECRET GITHUB_APP_PRIVATE_KEY; do
    if [ -n "$(printenv "$k")" ]; then echo "$k=SET"; else echo "$k=MISSING"; fi
  done
'
```

All of the above except Client ID should be **SET**. Client ID is recommended; ID + private key are required for the client to construct.

---

## 4. Product verification

1. Open `https://saidloop.com/app/settings/integrations`
2. Click **GitHub Issues → Connect** (or GitHub App connect if shown)
3. Expect: no red banner; browser goes to  
   `https://github.com/apps/saidloop-auto-pr/installations/new?...`
4. Install on the org/user + select repos
5. Return to Integrations → pick default repo → Save

Network tab: install request should be **200** with a JSON `url` (or a redirect when `browser=1`), not **503**.

---

## 5. Webhook smoke check

After install, GitHub → App → **Advanced → Recent deliveries**:

| Status | Likely cause |
| --- | --- |
| **200** | OK |
| **401** | `GITHUB_APP_WEBHOOK_SECRET` ≠ App webhook secret |
| **404** | Wrong webhook URL / nginx not proxying `/webhooks/github` to backend |
| **5xx** | Check `docker compose logs backend` |

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| UI: “GitHub App is not configured on server” + 503 | `GITHUB_APP_ID` or private key missing/unreadable in **backend** container |
| Env set on host but still 503 | Forgot recreate container; or used `PRIVATE_KEY_PATH` without mounting PEM |
| Install works, webhook 401 | Align webhook secret on GitHub + env, recreate backend |
| Redirect lands on wrong host | Set `API_URL` / `WEB_URL` to prod HTTPS URLs |
| Deploy wiped something | Confirm `.env` is untracked and still present after `git reset --hard` |

Code path: `GET /api/integrations/github/install` → `githubAppClient()` → 503 if client init fails (`project/backend/internal/interfaces/http/autopr.go`).

Compose env wiring: `docker-compose.yml` → service `backend` → `env_file`.

---

## Security notes

- Never commit PEM, webhook secret, or Client secret to git or GHCR image layers.
- Prefer a secrets manager or VM-local `.env` with `chmod 600`.
- Rotate webhook secret + private key if they ever appear in chat, CI logs, or a PR.
- After rotating, update both GitHub App settings and VM env, then recreate `backend`.

---

## Handoff checklist (copy for ticket)

- [ ] GitHub App webhook URL = `https://api.saidloop.com/webhooks/github`
- [ ] Setup URL = `https://api.saidloop.com/api/integrations/github/callback`
- [ ] Prod `project/.env` has `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_PRIVATE_KEY`
- [ ] `API_URL` / `WEB_URL` are production HTTPS
- [ ] `docker compose up -d --force-recreate backend`
- [ ] Container env check: required keys **SET**
- [ ] Integrations → Connect opens GitHub install (no 503)
- [ ] Recent webhook deliveries return 200
