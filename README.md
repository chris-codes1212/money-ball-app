# money-ball-app

A faux **MLB pitch-level live betting** app. Users watch a live game and bet
play-money on the outcome of the **next pitch** (strike / ball / hit /
non-strike foul). Odds come from a machine-learning model; bets settle
automatically against the real pitch result.

🔗 **Live:** https://mlb-money-ball.app

> Play money only — this is a portfolio/demo project, not a real sportsbook.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Local development](#local-development)
- [Configuration](#configuration)
- [AWS deployment (CDK)](#aws-deployment-cdk)
- [CI/CD pipeline](#cicd-pipeline)
- [Operations cheat-sheet](#operations-cheat-sheet)

---

## Features

- **Live pitch odds** streamed over WebSocket, priced by an XGBoost/scikit-learn
  model (loaded from Weights & Biases) with a vig applied. Falls back to
  placeholder odds if the model can't load.
- **Place bets** on the next pitch with a bet slip (stake + live potential
  payout). Stake is debited atomically the moment you confirm.
- **Automatic settlement** — each pitch is graded from the authoritative MLB
  feed and bets resolve to **WON / LOST / VOID** with payouts/refunds credited.
- **Live game page** — your bets update in place (~1.5s) and the navbar balance
  stays in sync.
- **Guardrails**
  - One live bet per game at a time (locked until it settles).
  - Betting only opens when a game is live or within 5 min of first pitch.
  - Server-authoritative anti-exploit checks: you can't bet on a pitch whose
    outcome already happened (verified against the backend, not the browser).
  - American-odds sign handling, money stored as `Decimal` (never floats).
- **Auth** via NextAuth (credentials), per-user bankroll + bet history.
- **Responsive** layout (phone / tablet / desktop).

---

## Architecture

```
                         Route 53 (DNS)  +  ACM (TLS)
                                   │
                        ┌────────  ALB (HTTPS :443)  ────────┐
                        │  mlb-money-ball.app   → frontend    │
                        │  api.mlb-money-ball.app → backend   │
                        ▼                                     ▼
              ECS Fargate: frontend (Next.js)     ECS Fargate: backend (FastAPI)
                        │                                     │
                        └──────────►  RDS PostgreSQL  ◄───────┘

   EventBridge ──(POST /api/settle, ~1/min)──► frontend   (settlement backstop)
   ECR ◄── CodeBuild ◄── CodePipeline ◄── GitHub          (CI/CD)
```

Three connection paths (the subtle part):

| Path | URL |
|------|-----|
| Browser → backend (live odds WebSocket) | `wss://api.mlb-money-ball.app` (baked into the bundle at build time) |
| Next server → backend (live games, pitch results) | `FAST_API_BACKEND_URL` |
| Browser → frontend | `https://mlb-money-ball.app` |

The **database is owned solely by the Next.js/Prisma layer** (single source of
truth for money). The backend never writes to it — it serves the MLB feed and
graded pitch results, and the frontend settles bets.

---

## Repository layout

Single monorepo:

```
money-ball-app/
├── frontend/        Next.js app — UI, auth, betting, settlement, Prisma schema
│   ├── app/         routes (pages + /api/* route handlers)
│   ├── components/  React components (MatchupCard, BetSlip, NavBar, ...)
│   ├── lib/         betting math, settlement, prisma client, game-window logic
│   └── prisma/      schema + migrations
├── backend/         FastAPI app — live odds WebSocket, pitch grading, ML model
│   └── src/         model training pipeline + custom transformers
├── infra/           AWS CDK (TypeScript) — all cloud infrastructure
│   └── lib/         Network / Data / App / Build / Pipeline stacks
├── docker-compose.yml   full local stack
└── README.md
```

---

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, NextAuth, Tailwind CSS,
  Prisma 7 (`@prisma/adapter-pg`).
- **Backend:** FastAPI, Uvicorn, APScheduler, MLB-StatsAPI, scikit-learn 1.6.1
  + XGBoost (model), Weights & Biases (model registry).
- **Database:** PostgreSQL.
- **Infra:** AWS CDK (TypeScript) → ECS Fargate, RDS, ALB, ACM, Route 53, ECR,
  CodePipeline/CodeBuild, EventBridge, Secrets Manager.

---

## How it works

**Odds.** The backend polls the MLB StatsAPI for each watched game, runs the
current matchup through the model to get pitch-outcome probabilities, applies a
vig, converts to American odds, and broadcasts over WebSocket. A latest-payload
cache lets a client that joins mid-at-bat see odds immediately.

**Placing a bet.** The bet slip sends the selected outcome + the pitch it's
bound to (game, at-bat, count). `POST /api/bets` validates it, confirms with the
backend that the game is open and the bet is on the *current* pitch, then debits
the stake and writes a `PENDING` bet — all in one transaction.

**Settlement.** Pitches are graded with the **same rules the model was trained
on** (`backend/src/data_loader.map_outcome_coarse`, mirrored for StatsAPI). A
bet is matched to the pitch thrown from its count *after* it was placed and
resolved to WON/LOST; if the pitch never comes (play moves on), it's VOIDed and
refunded. Settlement runs per-user live on the game page and via an EventBridge
schedule as a backstop — both idempotent.

---

## Local development

Run everything in Docker, or run the DB in Docker and the apps on your host for
hot reload. All commands from the repo root.

### Full stack (Docker Compose)

```bash
cp .env.example .env        # fill AUTH_SECRET, NEXTAUTH_SECRET, SETTLE_SECRET, WANDB_API_KEY
docker compose up --build   # add -d to detach
```

Open http://localhost:3000 (backend at :8000). Services: `db`, `migrate`
(one-off Prisma migrate), `backend`, `frontend`, `settler` (settlement poller).
`docker compose down -v` resets the DB volume.

### Host (hot reload)

```bash
docker compose up -d db                       # just Postgres

cd backend                                    # Python 3.12 venv with model deps
python3.12 -m venv .venv312 && .venv312/bin/pip install -r requirements.txt
.venv312/bin/python -m uvicorn main:app --reload --port 8000

cd frontend                                   # localhost overrides for host runs
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb \
FAST_API_BACKEND_URL=http://localhost:8000 \
pnpm install && pnpm dev
```

> `.env`/`.env.local` use `host.docker.internal`, which only resolves *inside*
> containers — use `localhost` when running the apps directly on your host.

---

## Configuration

Environment variables (see `frontend/.env.example`, `backend/.env.example`, and
the root `.env.example`). Never commit secrets — all `.env*` are gitignored
except the `.example` templates.

| Variable | Used by | Notes |
|----------|---------|-------|
| `DATABASE_URL` | frontend | Postgres connection (`?sslmode=no-verify` for RDS) |
| `FAST_API_BACKEND_URL` | frontend (server) | backend base URL for server-side fetches |
| `NEXT_PUBLIC_BACKEND_WS_URL` | frontend (build) | browser WebSocket URL, baked in at build |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | frontend | NextAuth signing secret |
| `NEXTAUTH_URL` | frontend | app base URL |
| `SETTLE_SECRET` | frontend + settler | guards `POST /api/settle` |
| `WANDB_API_KEY` | backend | loads the model; placeholder odds without it |
| `APP_TIMEZONE` | backend | timezone for "today's games" (default `America/New_York`) |

In AWS these are injected from **Secrets Manager** (DB creds, auth/settle
secrets, W&B key) — never baked into images.

---

## AWS deployment (CDK)

Lean, single-region (`us-east-1`) topology — public subnets, **no NAT gateway**
(tasks get public IPs for egress; security groups lock down access). CDK stacks
in `infra/lib`:

| Stack | Contents |
|-------|----------|
| `MoneyBallNetwork` | VPC (public subnets) + security groups |
| `MoneyBallData` | RDS PostgreSQL + generated credentials in Secrets Manager |
| `MoneyBallApp` | ECS cluster, frontend + backend Fargate services, ALB (HTTPS, host-routing), ACM cert, Route 53 records, app secrets, one-off migrate task, EventBridge settlement schedule |
| `MoneyBallBuild` | ECR repos + a CodeBuild project that builds images in AWS |
| `MoneyBallPipeline` | CodePipeline (GitHub → build → deploy) |

First-time setup:

```bash
cd infra && npm ci
npx cdk bootstrap aws://<account>/us-east-1
npx cdk deploy MoneyBallNetwork MoneyBallData MoneyBallBuild MoneyBallApp
npx cdk deploy MoneyBallPipeline   # after authorizing the GitHub connection in the console
```

**DNS/SSL:** a Route 53–registered domain + an auto-renewing ACM certificate on
the ALB. (`.app` is HSTS-preloaded, so HTTPS is mandatory — which ACM provides.)

**Cost:** roughly **$45–60/mo** (RDS + ALB + 2 small Fargate tasks). Tear it all
down with `cd infra && npx cdk destroy --all`.

---

## CI/CD pipeline

Push to `main` → **CodePipeline** runs automatically:

1. **Source** — pulls the commit from GitHub (CodeStar connection).
2. **Build** — CodeBuild builds both Docker images *in AWS* and pushes them to
   ECR, tagged by commit SHA. (Building in the cloud avoids unreliable large
   image uploads from a laptop.)
3. **Deploy** — runs `cdk deploy MoneyBallApp` with the new image tag (rolling
   ECS update with circuit-breaker rollback), then runs the Prisma migration
   task.

Images use the **ECR Public mirror** for base images to dodge Docker Hub rate
limits.

---

## Operations cheat-sheet

```bash
# Tail logs
aws logs tail /aws/ecs/... --follow            # or via the CloudWatch console

# Force a backend restart (e.g. after changing a secret)
aws ecs update-service --cluster <cluster> --service <backend-service> --force-new-deployment

# Update the W&B key, then restart the backend so it reloads the model
aws secretsmanager put-secret-value --secret-id <WandbApiKey-arn> --secret-string '<key>'

# Manually trigger settlement (normally automatic)
curl -X POST https://mlb-money-ball.app/api/settle -H "x-settle-secret: <secret>"

# Tear everything down
cd infra && npx cdk destroy --all
```
