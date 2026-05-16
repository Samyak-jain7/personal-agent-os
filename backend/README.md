# Personal AgentOS Backend

FastAPI control plane with SQLite persistence and a deterministic internal state graph.

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
pytest tests/backend
```

