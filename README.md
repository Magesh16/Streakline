# Streakline

Daily consistency tracker with timers, weekly-rule streaks, per-user accounts and Gemini-written weekly insights.

- **Client:** React + Vite + TypeScript (`client/`)
- **Server:** Node + Express (`server/`)
- **Database:** MongoDB 7 in Docker (`docker-compose.yml`), bound to localhost with a generated password in `.env`

## Run
    npm run install:all
    npm run mongo:up       # starts the streakline-mongo container (data persists in a Docker volume)
    npm run dev            # client http://localhost:5180, API :4100
    # or production, one port:
    npm run build && npm start   # http://localhost:4100

`.env` (git-ignored) holds `MONGODB_URI`, `MONGODB_DB`, and the Mongo root password. Optional env vars:
`ALLOW_SIGNUP=false` (close sign-ups once the first account exists), `APP_SECRET` (key for encrypting stored API keys; otherwise a random one is kept in `server/data/.secret`), `COOKIE_SECURE=true` (when served over HTTPS), `GEMINI_API_KEY` (shared fallback key).

## Accounts & data
Sign-up / sign-in with email + password (scrypt hashed). Login is an HttpOnly, SameSite=Lax cookie; only a hash of the token is stored, and Mongo expires old logins itself (30 days). Every record is scoped to its owner.
Collections: `users`, `habits`, `sessions`, `timers`, `insights`, `auth_sessions`, `meta`.
Gemini keys are stored AES-256-GCM encrypted. If an old `server/data/db.json` exists, the **first account created imports it** (file is renamed `db.json.migrated-*`, not deleted).

## Rules
A day counts when you log >= `minutesPerDay`. A week is complete when counted days >= `daysPerWeek`. Streak = consecutive completed weeks; the in-progress week never breaks it.

## Interface
- **Design:** neutral graphite / warm-paper chrome, colour comes from your own activities. Fonts: Bricolage Grotesque (display) + Geist (text). `client/src/styles.css` holds the base components and tokens, `client/src/polish.css` the refined visual layer.
- **Command palette:** Ctrl/Cmd+K from anywhere. Jump to any page, add an expense / loan / activity / session, start, pause or stop a timer, switch theme, sign out.
- **Focus mode:** the expand button on the running-timer bar opens a full-screen timer (keeps the screen awake where supported). Esc leaves it.
- **Phones:** floating glass dock with a raised "+" for quick add (expense, loan, session, activity). Quick-add sheets are shared with the palette.
- Money lives under the **Money** tab (Expenses | Lent). Respects `prefers-reduced-motion`.
