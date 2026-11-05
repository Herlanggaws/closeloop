# Closeloop demo host (Bear Budget Web)

Tiny product surface used to dogfood the web widget end-to-end.

## Flow

1. Start Closeloop (`pnpm dev` from `project/`) so API `:8080` and frontend `:3000` are up. Frontend dev builds `/w.js`.
2. Sign in → **Create project** (`/app/onboarding`) → continue to **Install**.
3. Open the demo link shown on Install, or:

   ```
   http://localhost:3000/demo.html?key=YOUR_PUBLIC_KEY
   ```

4. Click **Report** in the corner, send a bug/idea/question.
5. Install page flips to **First report received**; the ticket appears in `/app/inbox`.

## Files

| Path | Role |
| --- | --- |
| [`../frontend/public/demo.html`](../frontend/public/demo.html) | Live demo page (served by Next) |
| [`index.html`](./index.html) | Shortcut that forwards to the frontend URL with the same query |

Optional query params: `api` (default `http://localhost:8080`), `widget`, `user_id`, `email`, `app_version`.

The balance uses `data-closeloop-mask` so the widget blurs it in screenshots.
