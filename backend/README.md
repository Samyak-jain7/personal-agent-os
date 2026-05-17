# Personal AgentOS Backend

FastAPI control plane with SQLite persistence and a deterministic internal state graph.

The backend can call real read-only Composio tools through the local Composio CLI. By default it looks for `~/.composio/composio`. Override it with `COMPOSIO_CLI_PATH=/path/to/composio`.

## Run

```bash
cd /home/sj221097/.openclaw/workspace/personal-agent-os
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app:app --reload
```

The default database is `backend/agentos.sqlite3`. Override it with:

```bash
AGENTOS_DB_PATH=/tmp/agentos.sqlite3 uvicorn backend.app:app --reload
```

## Test

```bash
PYTHONPATH=. pytest tests/backend
```

## Tool Endpoints

List connected tools and recent tool runs:

```bash
curl http://localhost:8000/api/tools
```

Run the safe Gmail fetch bridge:

```bash
curl --request POST http://localhost:8000/api/tools/gmail.fetch/execute \
  --header 'Content-Type: application/json' \
  --data '{"payload":{"query":"newer_than:1d","max_results":3}}'
```
