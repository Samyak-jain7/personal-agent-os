# Summon Scripts

Summon scripts are small local entrypoints that wake the personal agent UI and notify the backend.

## Keyboard Summon

Run directly:

```bash
./summon/keyboard-summon.sh
```

Recommended keyboard binding:

```bash
cd /home/sj221097/.openclaw/workspace/personal-agent-os && ./summon/keyboard-summon.sh
```

The script:

- opens `DASHBOARD_URL`, defaulting to `http://localhost:5173`
- sends `POST /api/summon` to `BACKEND_URL`, defaulting to `http://localhost:8000`
- includes source, message, and trigger metadata

Override defaults when needed:

```bash
BACKEND_URL=http://localhost:8000 \
DASHBOARD_URL=http://localhost:5173 \
SUMMON_MESSAGE="Review today's priorities" \
./summon/keyboard-summon.sh
```
