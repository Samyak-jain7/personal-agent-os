from fastapi.testclient import TestClient

from backend.app import create_app


def client(tmp_path):
    app = create_app(tmp_path / "agentos-test.sqlite3")
    return TestClient(app)


def test_health_and_seed_agents(tmp_path):
    api = client(tmp_path)

    health = api.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    response = api.get("/api/agents")
    assert response.status_code == 200
    agents = response.json()["agents"]
    assert len(agents) == 5
    assert {agent["name"] for agent in agents} >= {
        "Jarvis Orchestrator",
        "News Scout",
        "Reminder Sentinel",
        "Project Engineer",
        "Research Analyst",
    }


def test_summon_persists_run_timeline_and_tool_logs(tmp_path):
    api = client(tmp_path)

    response = api.post(
        "/api/summon",
        json={"source": "telegram", "message": "Build a project briefing and research plan"},
    )

    assert response.status_code == 201
    run = response.json()
    assert run["status"] == "completed"
    assert run["source"] == "telegram"
    assert run["summary"]
    assert [step["name"] for step in run["steps"]] == [
        "intake",
        "plan",
        "route",
        "execute workers",
        "synthesize",
    ]
    assert len(run["tool_logs"]) == 5

    detail = api.get(f"/api/runs/{run['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == run["id"]

    runs = api.get("/api/runs")
    assert runs.status_code == 200
    assert runs.json()["runs"][0]["id"] == run["id"]


def test_retry_creates_new_run_linked_to_original(tmp_path):
    api = client(tmp_path)
    original = api.post(
        "/api/summon",
        json={"source": "web", "message": "Remind me to review this project"},
    ).json()

    retry = api.post(f"/api/runs/{original['id']}/retry")

    assert retry.status_code == 201
    retried = retry.json()
    assert retried["id"] != original["id"]
    assert retried["retry_of"] == original["id"]
    assert retried["message"] == original["message"]
    assert len(retried["steps"]) == 5


def test_briefing_reflects_runs(tmp_path):
    api = client(tmp_path)
    api.post("/api/summon", json={"source": "cli", "message": "Analyze latest AI news"})

    response = api.get("/api/briefing")

    assert response.status_code == 200
    briefing = response.json()
    assert briefing["agents_online"] == 5
    assert briefing["total_runs"] == 1
    assert briefing["completed_runs"] == 1
    assert briefing["recent_runs"][0]["source"] == "cli"


def test_dashboard_payload_has_frontend_contract(tmp_path):
    api = client(tmp_path)
    api.post("/api/summon", json={"source": "keyboard", "message": "Open mission control"})

    response = api.get("/api/dashboard")

    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["agents"]
    assert dashboard["metrics"]
    assert dashboard["timeline"]
    assert dashboard["briefing"]["followUps"]
    assert dashboard["run"]["id"] != "no_runs_yet"
    assert dashboard["tools"]["tools"]


def test_composio_tool_status_and_execution_with_fake_cli(tmp_path, monkeypatch):
    fake_cli = tmp_path / "composio"
    fake_cli.write_text(
        "#!/usr/bin/env bash\n"
        "printf '{\"ok\":true,\"action\":\"%s\"}' \"$2\"\n",
        encoding="utf-8",
    )
    fake_cli.chmod(0o755)
    monkeypatch.setenv("COMPOSIO_CLI_PATH", str(fake_cli))

    api = client(tmp_path)

    tools = api.get("/api/tools")
    assert tools.status_code == 200
    assert tools.json()["available"] is True

    response = api.post(
        "/api/tools/gmail.fetch/execute",
        json={"payload": {"query": "from:test@example.com", "max_results": 1}},
    )

    assert response.status_code == 201
    run = response.json()
    assert run["status"] == "completed"
    assert run["tool_id"] == "gmail.fetch"
    assert run["input"]["query"] == "from:test@example.com"
    assert run["output"]["ok"] is True


def test_summon_can_call_matching_read_only_composio_tool(tmp_path, monkeypatch):
    fake_cli = tmp_path / "composio"
    fake_cli.write_text(
        "#!/usr/bin/env bash\n"
        "printf '{\"messages\":[{\"subject\":\"Interview update\"}]}'\n",
        encoding="utf-8",
    )
    fake_cli.chmod(0o755)
    monkeypatch.setenv("COMPOSIO_CLI_PATH", str(fake_cli))

    api = client(tmp_path)
    response = api.post(
        "/api/summon",
        json={"source": "telegram", "message": "Check my unread Gmail follow-ups"},
    )

    assert response.status_code == 201
    run = response.json()
    intake_step = next(step for step in run["steps"] if step["name"] == "intake")
    plan_step = next(step for step in run["steps"] if step["name"] == "plan")
    route_step = next(step for step in run["steps"] if step["name"] == "route")
    execute_step = next(step for step in run["steps"] if step["name"] == "execute workers")
    assert intake_step["output"]["selected_composio_tools"][0]["id"] == "gmail.search_unread"
    assert plan_step["output"]["selected_composio_tools"][0]["id"] == "gmail.search_unread"
    assert route_step["output"]["selected_composio_tools"][0]["id"] == "gmail.search_unread"
    assert execute_step["output"]["tool_results"][0]["status"] == "completed"
    assert execute_step["output"]["selected_composio_tools"][0]["id"] == "gmail.search_unread"
    assert "gmail.search_unread" in run["summary"]


def test_missing_run_returns_404(tmp_path):
    api = client(tmp_path)

    assert api.get("/api/runs/missing").status_code == 404
    assert api.post("/api/runs/missing/retry").status_code == 404
