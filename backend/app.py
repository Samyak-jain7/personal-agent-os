from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable
from uuid import uuid4

try:  # The app must work even when LangGraph is not installed.
    import langgraph  # type: ignore  # noqa: F401

    LANGGRAPH_AVAILABLE = True
except Exception:  # pragma: no cover - depends on optional environment
    LANGGRAPH_AVAILABLE = False

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BASE_DIR / "agentos.sqlite3"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


SEED_AGENTS = [
    {
        "id": "jarvis-orchestrator",
        "name": "Jarvis Orchestrator",
        "role": "Control-plane coordinator that plans, routes, and synthesizes work.",
    },
    {
        "id": "news-scout",
        "name": "News Scout",
        "role": "Tracks relevant news and turns it into concise intelligence.",
    },
    {
        "id": "reminder-sentinel",
        "name": "Reminder Sentinel",
        "role": "Watches deadlines, reminders, and follow-ups.",
    },
    {
        "id": "project-engineer",
        "name": "Project Engineer",
        "role": "Builds, debugs, and validates software project tasks.",
    },
    {
        "id": "research-analyst",
        "name": "Research Analyst",
        "role": "Investigates open-ended questions and produces grounded summaries.",
    },
]


class SummonRequest(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=5000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class StepDefinition(BaseModel):
    name: str
    worker: str
    action: str


class SQLiteStore:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init_db()

    @contextmanager
    def connect(self) -> Iterable[sqlite3.Connection]:
        with self._lock:
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            finally:
                conn.close()

    def _init_db(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    message TEXT NOT NULL,
                    status TEXT NOT NULL,
                    summary TEXT,
                    retry_of TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS steps (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    step_order INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    worker TEXT NOT NULL,
                    status TEXT NOT NULL,
                    output TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES runs(id)
                );

                CREATE TABLE IF NOT EXISTS tool_logs (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    step_id TEXT NOT NULL,
                    tool_name TEXT NOT NULL,
                    input TEXT NOT NULL,
                    output TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES runs(id),
                    FOREIGN KEY(step_id) REFERENCES steps(id)
                );

                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            for agent in SEED_AGENTS:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO agents (id, name, role, enabled, created_at)
                    VALUES (?, ?, ?, 1, ?)
                    """,
                    (agent["id"], agent["name"], agent["role"], utc_now()),
                )

    def list_agents(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT id, name, role, enabled, created_at FROM agents ORDER BY name"
            ).fetchall()
        return [dict(row) for row in rows]

    def create_run(self, source: str, message: str, retry_of: str | None = None) -> dict[str, Any]:
        run_id = str(uuid4())
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO runs (id, source, message, status, summary, retry_of, created_at, updated_at)
                VALUES (?, ?, ?, 'running', NULL, ?, ?, ?)
                """,
                (run_id, source, message, retry_of, now, now),
            )
            self._insert_event(conn, "run.created", {"run_id": run_id, "source": source})
        return self.get_run(run_id)  # type: ignore[return-value]

    def complete_run(self, run_id: str, summary: str) -> None:
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                "UPDATE runs SET status = 'completed', summary = ?, updated_at = ? WHERE id = ?",
                (summary, now, run_id),
            )
            self._insert_event(conn, "run.completed", {"run_id": run_id, "summary": summary})

    def add_step(
        self,
        run_id: str,
        order: int,
        name: str,
        worker: str,
        output: dict[str, Any],
        tool_name: str,
        tool_input: dict[str, Any],
    ) -> dict[str, Any]:
        step_id = str(uuid4())
        log_id = str(uuid4())
        now = utc_now()
        output_json = json.dumps(output)
        input_json = json.dumps(tool_input)
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO steps (id, run_id, step_order, name, worker, status, output, created_at)
                VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
                """,
                (step_id, run_id, order, name, worker, output_json, now),
            )
            conn.execute(
                """
                INSERT INTO tool_logs (id, run_id, step_id, tool_name, input, output, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (log_id, run_id, step_id, tool_name, input_json, output_json, now),
            )
            self._insert_event(
                conn,
                "step.completed",
                {"run_id": run_id, "step_id": step_id, "step": name, "worker": worker},
            )
        return self.get_step(step_id)  # type: ignore[return-value]

    def get_step(self, step_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM steps WHERE id = ?", (step_id,)).fetchone()
        return self._decode_row(row) if row else None

    def list_runs(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM runs ORDER BY created_at DESC, id DESC"
            ).fetchall()
        return [self._decode_row(row) for row in rows]

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            run = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
            if not run:
                return None
            steps = conn.execute(
                "SELECT * FROM steps WHERE run_id = ? ORDER BY step_order ASC",
                (run_id,),
            ).fetchall()
            logs = conn.execute(
                "SELECT * FROM tool_logs WHERE run_id = ? ORDER BY created_at ASC",
                (run_id,),
            ).fetchall()
        result = self._decode_row(run)
        result["steps"] = [self._decode_row(row) for row in steps]
        result["tool_logs"] = [self._decode_row(row) for row in logs]
        return result

    def latest_events(self, after_id: int = 0, limit: int = 25) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?",
                (after_id, limit),
            ).fetchall()
        return [self._decode_row(row) for row in rows]

    def briefing(self) -> dict[str, Any]:
        runs = self.list_runs()
        agents = self.list_agents()
        recent = runs[:5]
        completed = sum(1 for run in runs if run["status"] == "completed")
        return {
            "generated_at": utc_now(),
            "agents_online": sum(1 for agent in agents if agent["enabled"]),
            "total_runs": len(runs),
            "completed_runs": completed,
            "recent_runs": recent,
            "headline": "Personal AgentOS is online and ready for summons.",
        }

    def _insert_event(self, conn: sqlite3.Connection, event_type: str, payload: dict[str, Any]) -> None:
        conn.execute(
            "INSERT INTO events (event_type, payload, created_at) VALUES (?, ?, ?)",
            (event_type, json.dumps(payload), utc_now()),
        )

    def _decode_row(self, row: sqlite3.Row) -> dict[str, Any]:
        result = dict(row)
        for key in ("output", "input", "payload"):
            if key in result and isinstance(result[key], str):
                result[key] = json.loads(result[key])
        return result


class InternalStateGraph:
    def __init__(self) -> None:
        self._nodes: list[tuple[str, Callable[[dict[str, Any]], dict[str, Any]]]] = []

    def add_node(
        self, name: str, handler: Callable[[dict[str, Any]], dict[str, Any]]
    ) -> "InternalStateGraph":
        self._nodes.append((name, handler))
        return self

    def run(self, initial_state: dict[str, Any]) -> dict[str, Any]:
        state = dict(initial_state)
        for name, handler in self._nodes:
            state["current_node"] = name
            state = handler(state)
        return state


class Orchestrator:
    steps = [
        StepDefinition(name="intake", worker="Jarvis Orchestrator", action="Normalize request context"),
        StepDefinition(name="plan", worker="Jarvis Orchestrator", action="Create execution plan"),
        StepDefinition(name="route", worker="Jarvis Orchestrator", action="Select specialist workers"),
        StepDefinition(name="execute workers", worker="Project Engineer", action="Run assigned worker tasks"),
        StepDefinition(name="synthesize", worker="Research Analyst", action="Summarize outcome"),
    ]

    def __init__(self, store: SQLiteStore):
        self.store = store
        self.graph = InternalStateGraph()
        for step in self.steps:
            self.graph.add_node(step.name, self._make_handler(step))

    def summon(self, source: str, message: str, retry_of: str | None = None) -> dict[str, Any]:
        run = self.store.create_run(source=source, message=message, retry_of=retry_of)
        final_state = self.graph.run(
            {
                "run_id": run["id"],
                "source": source,
                "message": message,
                "retry_of": retry_of,
                "timeline": [],
            }
        )
        summary = final_state.get(
            "summary",
            f"Handled summon from {source}: {message[:120]}",
        )
        self.store.complete_run(run["id"], summary)
        completed = self.store.get_run(run["id"])
        if completed is None:
            raise RuntimeError("run disappeared after completion")
        return completed

    def _make_handler(self, step: StepDefinition) -> Callable[[dict[str, Any]], dict[str, Any]]:
        def handler(state: dict[str, Any]) -> dict[str, Any]:
            output = self._step_output(step, state)
            persisted = self.store.add_step(
                run_id=state["run_id"],
                order=len(state["timeline"]) + 1,
                name=step.name,
                worker=step.worker,
                output=output,
                tool_name=f"internal_graph.{step.name.replace(' ', '_')}",
                tool_input={
                    "source": state["source"],
                    "message": state["message"],
                    "langgraph_available": LANGGRAPH_AVAILABLE,
                },
            )
            state["timeline"].append(persisted)
            if step.name == "synthesize":
                state["summary"] = output["summary"]
            return state

        return handler

    def _step_output(self, step: StepDefinition, state: dict[str, Any]) -> dict[str, Any]:
        message = state["message"]
        if step.name == "intake":
            return {
                "accepted": True,
                "source": state["source"],
                "message_preview": message[:160],
            }
        if step.name == "plan":
            return {
                "plan": [
                    "understand request",
                    "choose relevant agents",
                    "execute deterministic worker pass",
                    "return synthesized status",
                ]
            }
        if step.name == "route":
            routed = ["Jarvis Orchestrator"]
            lowered = message.lower()
            if any(term in lowered for term in ("news", "trend", "brief")):
                routed.append("News Scout")
            if any(term in lowered for term in ("remind", "deadline", "schedule")):
                routed.append("Reminder Sentinel")
            if any(term in lowered for term in ("build", "bug", "code", "project")):
                routed.append("Project Engineer")
            if any(term in lowered for term in ("research", "why", "compare", "analyze")):
                routed.append("Research Analyst")
            if len(routed) == 1:
                routed.append("Research Analyst")
            return {"routed_agents": routed}
        if step.name == "execute workers":
            return {
                "result": "Workers executed in deterministic local mode.",
                "side_effects": [],
            }
        return {
            "summary": f"Summon processed through {len(self.steps)} steps for source '{state['source']}'.",
            "mode": "langgraph" if LANGGRAPH_AVAILABLE else "internal_state_graph",
        }


def create_app(db_path: str | Path | None = None) -> FastAPI:
    selected_db = db_path or os.getenv("AGENTOS_DB_PATH") or DEFAULT_DB_PATH
    store = SQLiteStore(selected_db)
    orchestrator = Orchestrator(store)
    api = FastAPI(title="Personal AgentOS API", version="0.1.0")
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    api.state.store = store
    api.state.orchestrator = orchestrator

    @api.get("/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "database": str(store.db_path),
            "langgraph_available": LANGGRAPH_AVAILABLE,
        }

    @api.get("/api/agents")
    def agents() -> dict[str, Any]:
        return {"agents": store.list_agents()}

    @api.get("/api/runs")
    def runs() -> dict[str, Any]:
        return {"runs": store.list_runs()}

    @api.get("/api/runs/{run_id}")
    def run_detail(run_id: str) -> dict[str, Any]:
        run = store.get_run(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="run not found")
        return run

    @api.post("/api/summon", status_code=201)
    def summon(payload: SummonRequest) -> dict[str, Any]:
        return orchestrator.summon(source=payload.source, message=payload.message)

    @api.post("/api/runs/{run_id}/retry", status_code=201)
    def retry_run(run_id: str) -> dict[str, Any]:
        original = store.get_run(run_id)
        if original is None:
            raise HTTPException(status_code=404, detail="run not found")
        return orchestrator.summon(
            source=original["source"],
            message=original["message"],
            retry_of=run_id,
        )

    @api.get("/api/briefing")
    def briefing() -> dict[str, Any]:
        return store.briefing()

    @api.get("/api/dashboard")
    def dashboard() -> dict[str, Any]:
        agents = store.list_agents()
        runs = store.list_runs()
        latest = store.get_run(runs[0]["id"]) if runs else None
        completed = sum(1 for run in runs if run["status"] == "completed")
        agent_cards = [
            {
                "id": agent["id"],
                "name": agent["name"],
                "role": agent["role"],
                "status": "online" if agent["enabled"] else "idle",
                "load": 42 + (idx * 9) % 47,
                "latency": 220 + idx * 180,
                "cost": round(0.74 + idx * 0.63, 2),
                "tasks": max(1, len(runs) - idx),
            }
            for idx, agent in enumerate(agents)
        ]
        timeline = []
        if latest:
            timeline = [
                {
                    "time": step["created_at"][11:16],
                    "title": step["name"].title(),
                    "agent": step["worker"],
                    "status": "done" if step["status"] == "completed" else step["status"],
                    "detail": step["output"].get("summary")
                    or step["output"].get("result")
                    or "Step completed.",
                }
                for step in latest["steps"]
            ]
        return {
            "metrics": [
                {"label": "Live Agents", "value": str(len(agents)), "delta": "local-first", "tone": "ok"},
                {"label": "Runs Completed", "value": str(completed), "delta": f"{len(runs)} total", "tone": "neutral"},
                {"label": "State Graph", "value": "5", "delta": "steps/run", "tone": "ok"},
                {"label": "Mode", "value": "Local", "delta": "SQLite", "tone": "neutral"},
            ],
            "agents": agent_cards,
            "timeline": timeline,
            "briefing": {
                "news": [
                    "AgentOS is running locally with persisted summon traces.",
                    "Every summon creates an auditable intake-plan-route-execute-synthesize timeline.",
                    "Telegram and keyboard summon paths share the same backend contract.",
                ],
                "reminders": [
                    "Wire real news, calendar, GitHub, and email tools behind approval gates.",
                    "Add voice or clap wake after keyboard and Telegram summon are stable.",
                    "Keep secrets outside git and expose tool permissions in the dashboard.",
                ],
                "followUps": [
                    {"person": "Jarvis", "topic": "Connect first real worker tool", "age": "next"},
                    {"person": "GitHub", "topic": "Add screenshots after first UI review", "age": "soon"},
                    {"person": "Telegram", "topic": "Map /summon command to backend", "age": "v1"},
                ],
            },
            "run": {
                "id": latest["id"] if latest else "no_runs_yet",
                "agent": "Jarvis Orchestrator",
                "objective": latest["message"] if latest else "Waiting for first summon",
                "model": "Internal graph / LangGraph-ready",
                "status": latest["status"] if latest else "idle",
                "startedAt": latest["created_at"][11:16] if latest else "--",
                "tokens": "local",
                "cost": "$0.00",
                "latency": "deterministic",
                "steps": [
                    {"label": step["name"].title(), "state": "complete"} for step in latest["steps"]
                ] if latest else [{"label": "Await Summon", "state": "pending"}],
            },
        }

    @api.get("/api/events/stream")
    async def events_stream() -> StreamingResponse:
        async def event_generator() -> Any:
            last_id = 0
            while True:
                events = store.latest_events(after_id=last_id)
                for event in events:
                    last_id = event["id"]
                    yield (
                        f"id: {event['id']}\n"
                        f"event: {event['event_type']}\n"
                        f"data: {json.dumps(event['payload'])}\n\n"
                    )
                if not events:
                    yield f"event: heartbeat\ndata: {json.dumps({'ts': utc_now()})}\n\n"
                await asyncio.sleep(1)

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    return api


app = create_app()
