# money-ball-app

A faux MLB **pitch-level live betting** app. Users watch a live game and bet on
the outcome of the next pitch (strike / ball / hit / non-strike foul) with
play-money; bets settle automatically against real pitch results.

## Architecture

| Part | Stack | Notes |
|------|-------|-------|
| `frontend/` | Next.js 16, NextAuth, Prisma | UI, auth, bets, bankroll/ledger (owns the database) |
| `backend/`  | FastAPI | Streams live pitch odds over WebSocket; grades pitch results; serves the ML model |
| database    | PostgreSQL | Users, bankroll, bets |

Server-side calls (Next → backend) use internal DNS; the browser talks to the
backend over a published WebSocket. Settlement is server-authoritative: the
backend grades each pitch from the MLB feed, and the Next app settles bets.

## Running with Docker (full stack)

Everything below is run from the repo root (where `docker-compose.yml` lives).

### Prerequisites

1. Docker Desktop running.
2. A root `.env` with secrets:
   ```bash
   cp .env.example .env
   # fill in AUTH_SECRET, NEXTAUTH_SECRET, SETTLE_SECRET, WANDB_API_KEY
   ```
   Generate secrets with `openssl rand -base64 32` (auth) / `openssl rand -hex 32`
   (settle). `WANDB_API_KEY` is optional — without it the backend serves
   placeholder odds instead of model predictions.
3. Ports `3000`, `8000`, `5432` free (stop any host dev servers / other Postgres first).

### Launch

```bash
docker compose up --build        # build + start (foreground)
docker compose up --build -d     # ...or detached
```

Startup runs DB migrations (one-off `migrate` job), then brings up the backend,
frontend, and a settlement poller. Then open:

- Frontend → http://localhost:3000  (register a new account; the compose DB starts empty)
- Backend  → http://localhost:8000  (`/health`, `/live_games`)

### Everyday commands

```bash
docker compose ps                # status / health
docker compose logs -f           # tail all logs (or: logs -f frontend|backend|settler|db)
docker compose restart backend   # restart one service
docker compose up -d --build frontend   # rebuild + restart just the frontend
docker compose down              # stop & remove containers (DB volume kept)
docker compose down -v           # also wipe the DB volume (fresh start)
```

### Services

- **db** — Postgres (volume `moneyball-pgdata`; separate from any host Postgres).
- **migrate** — runs `prisma migrate deploy` once, then exits.
- **backend** — FastAPI on `:8000`.
- **frontend** — Next.js on `:3000`.
- **settler** — posts to `/api/settle` every ~10s to settle pending bets (a
  backstop; the game page also settles a user's bets live as they watch).

## Local development (host, with hot reload)

Run the database in Docker but the apps directly on your machine for fast reloads:

```bash
# database
docker compose up -d db

# backend (uses a Python 3.12 venv with the model dependencies)
cd backend
python3.12 -m venv .venv312 && .venv312/bin/pip install -r requirements.txt
.venv312/bin/python -m uvicorn main:app --reload --port 8000

# frontend (override DATABASE_URL/backend URL to localhost for host runs)
cd frontend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb \
FAST_API_BACKEND_URL=http://localhost:8000 \
pnpm install && pnpm dev
```

> Note: `.env`/`.env.local` use `host.docker.internal`, which only resolves
> *inside* containers — use `localhost` when running the apps on the host.

## Configuration

See `.env.example` (root, for compose) and `frontend/.env.example` /
`backend/.env.example` for the full list of environment variables. Never commit
real secrets — all `.env*` files are gitignored (except the `.example` templates).
