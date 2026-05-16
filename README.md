# Personal Agent OS

Personal Agent OS is a local-first command center for summoning, steering, and observing a personal AI agent. The app is designed around a simple loop: open the dashboard, send a summon request, and let the backend coordinate the agent workflow.

## Architecture

```text
Keyboard shortcut / Telegram command
              |
              v
       POST /api/summon
              |
              v
Backend API on :8000  <---->  agent services, state, integrations
              |
              v
Frontend dashboard on :5173
```

- **Backend:** expected on `http://localhost:8000`
- **Frontend:** expected on `http://localhost:5173`
- **Summon API:** expected at `POST /api/summon`
- **Health API:** expected at `GET /health`

## Product Shape

The dashboard should feel like an operator console, not a landing page: current agent status, active tasks, summon history, recent decisions, and quick controls visible without digging through menus.

Screenshot placeholder:

```text
[ Dashboard visual ]
Left rail: current agent + summon controls
Main pane: active task timeline and recent agent events
Right pane: integrations, health, and next actions
```

## Features

- Local Docker Compose stack for backend and frontend
- Keyboard summon script that opens the dashboard and calls the backend
- Telegram summon flow documented for future webhook implementation
- Smoke test script for backend health and summon request verification
- Configurable local URLs through `.env`

## Run Locally

Create local environment config:

```bash
cp .env.example .env
```

Start the stack:

```bash
docker compose up --build
```

If this machine only has the legacy Compose binary:

```bash
docker-compose up --build
```

Open the dashboard:

```text
http://localhost:5173
```

Backend health:

```bash
curl http://localhost:8000/health
```

## Summon From Keyboard

```bash
./summon/keyboard-summon.sh
```

With a custom message:

```bash
SUMMON_MESSAGE="Open today's execution plan" ./summon/keyboard-summon.sh
```

## API Examples

Health:

```bash
curl --fail http://localhost:8000/health
```

Summon:

```bash
curl --fail --request POST http://localhost:8000/api/summon \
  --header 'Content-Type: application/json' \
  --data '{
    "source": "readme",
    "message": "Open the dashboard and prepare the agent.",
    "metadata": {
      "trigger": "manual"
    }
  }'
```

## Smoke Test

Run after the backend is up:

```bash
./scripts/smoke-e2e.sh
```

The script checks:

- `GET /health`
- `POST /api/summon`

Override the backend URL:

```bash
BACKEND_URL=http://localhost:8000 ./scripts/smoke-e2e.sh
```

## Telegram Summon

See [docs/telegram-summon.md](docs/telegram-summon.md) for the placeholder webhook and command contract.

## Development Notes

- Keep backend code on port `8000`.
- Keep frontend dev server on port `5173`.
- Keep summon integrations pointed at the same `POST /api/summon` contract.
- Do not commit secrets, bot tokens, or private owner IDs.
