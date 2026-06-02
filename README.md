# Fixora — Docker Setup

Dockerized dev + production for your MERN + Socket.io stack.

## Structure

```
fixora-docker/
├── backend/
│   ├── Dockerfile        ← multi-stage (dev hot-reload + prod)
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile        ← Vite dev server + nginx production
│   ├── nginx.conf
│   └── .dockerignore
├── nginx/
│   └── nginx.conf        ← reverse proxy (handles Socket.io WebSocket upgrade)
├── backups/              ← MongoDB dumps land here
├── docker-compose.yml        (production)
├── docker-compose.dev.yml    (development)
├── .env.example
├── Makefile
└── README.md
```

## Install into your project (5 min)

```bash
# 1. Copy Docker files INTO your Fixora project root
cp -r fixora-docker/* "/path/to/Fixora SaaS Web App UI/"
cp fixora-docker/.env.example "/path/to/Fixora SaaS Web App UI/.env"

# Final layout should be:
# Fixora SaaS Web App UI/
# ├── backend/         ← your existing code + new Dockerfile
# ├── frontend/        ← your existing code + new Dockerfile + nginx.conf
# ├── nginx/
# ├── backups/
# ├── docker-compose.yml
# ├── docker-compose.dev.yml
# ├── .env
# └── Makefile

# 2. Edit .env — fill in Gmail, admin, (later) Stripe
nano .env

# 3. Start everything
make dev
```

Hit **http://localhost:5173** — app loads. Backend at **http://localhost:5001**.

## Why this matches your project

| Your project | My Docker setup |
|---|---|
| Backend port **5001** | Exposed 5001, health check on `/api/health` |
| Frontend: **Vite** (not CRA) | Uses `npm run dev -- --host 0.0.0.0`, builds to `dist/` |
| **ES modules** (`"type": "module"`) | Runs `node src/server.js` correctly |
| `MONGO_DB=serviceProvider` | Preserved as env var |
| Gmail + SendGrid email | All env keys preserved |
| Socket.io on port 5001 | Nginx config upgrades WebSocket correctly |
| Google Maps in frontend | `VITE_GOOGLE_MAPS_API_KEY` passed at build time |

## Common issues & fixes

**"Cannot connect to MongoDB"**
→ Backend connects to `mongodb://mongodb:27017` (service name), not `localhost`. The compose file handles this.

**Frontend shows blank page in Docker**
→ Check Vite logs: `make logs-fe`. If you see `ready in X ms` but can't reach it, you're missing `--host 0.0.0.0` (already in the Dockerfile CMD).

**Hot reload not working**
→ `CHOKIDAR_USEPOLLING=true` is set. On Windows/WSL this is required. If still broken, check volume mount isn't being shadowed.

**Port 5001 already in use**
→ You have a local Node running. Kill it: `lsof -ti:5001 | xargs kill -9`

**"EACCES: permission denied" in backend**
→ Your host user owns files differently than container nodejs user (UID 1001). In dev this doesn't matter (running as root). In prod, rebuild.

## What's next

**Today:** `make dev` → confirm app loads, can signup, can create booking.

**Reply "socket.io next"** → I'll integrate Socket.io across your existing controllers:
- Emit on booking create/update/cancel → customer + provider see it instantly
- Emit on payment success → trigger UI update
- Emit on review posted → provider dashboard updates
- Admin dashboard: live feed of new signups, bookings, payments
- Socket auth middleware using your existing JWT

**After that:** Redis caching (for provider search, category list, session store) → Stripe → PWA → i18n → Rate limiting → OWASP.
