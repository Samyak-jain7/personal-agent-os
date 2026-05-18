import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlarmClock, ArrowUpRight, BellRing, Bot, BrainCircuit, CheckCircle2,
  ChevronRight, CircleDollarSign, Clock3, Command, Cpu, Gauge, GitBranch,
  LayoutDashboard, Menu, MessageSquareText, Newspaper, PanelRightOpen,
  RadioTower, Search, ServerCog, ShieldCheck, Sparkles, TerminalSquare, Timer,
  Workflow, Zap
} from 'lucide-react';
import './styles.css';

function resolveApiUrl() {
  const configured = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (typeof window !== 'undefined' && url.hostname === 'localhost' && window.location.hostname === '127.0.0.1') {
        url.hostname = '127.0.0.1';
        return url.origin;
      }
      return url.origin;
    } catch {
      return configured.replace(/\/$/, '');
    }
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname || 'localhost'}:8000`;
  }

  return 'http://localhost:8000';
}

const API_URL = resolveApiUrl();

const mockDashboard = {
  metrics: [
    { label: 'Live Agents', value: '12', delta: '+3', tone: 'ok', icon: Bot },
    { label: 'Tasks Running', value: '37', delta: '8 queued', tone: 'warn', icon: Workflow },
    { label: 'Avg Latency', value: '842ms', delta: '-18%', tone: 'ok', icon: Gauge },
    { label: 'Daily Spend', value: '$18.42', delta: '62% cap', tone: 'neutral', icon: CircleDollarSign }
  ],
  agents: [
    { id: 'summoner', name: 'Summoner', role: 'Command router', status: 'online', load: 74, latency: 218, cost: 2.11, tasks: 9 },
    { id: 'research', name: 'Research Hawk', role: 'News + web intelligence', status: 'online', load: 61, latency: 1120, cost: 5.48, tasks: 6 },
    { id: 'gmail', name: 'Inbox Sentinel', role: 'Mail triage + follow-ups', status: 'online', load: 38, latency: 536, cost: 1.73, tasks: 4 },
    { id: 'calendar', name: 'Calendar Ops', role: 'Schedule defense', status: 'idle', load: 18, latency: 312, cost: 0.82, tasks: 2 },
    { id: 'builder', name: 'Frontend Builder', role: 'UI implementation', status: 'busy', load: 88, latency: 1460, cost: 4.94, tasks: 11 },
    { id: 'memory', name: 'Memory Curator', role: 'Long-term context', status: 'online', load: 47, latency: 690, cost: 1.21, tasks: 5 }
  ],
  timeline: [
    { time: '09:20', title: 'Parsed overnight agent runs', agent: 'Memory Curator', status: 'done', detail: 'Condensed 14 events into long-term state.' },
    { time: '09:46', title: 'Generated briefing stack', agent: 'Research Hawk', status: 'running', detail: 'Scanning AI infra, hiring signals, and India weather.' },
    { time: '10:05', title: 'Queued follow-up draft', agent: 'Inbox Sentinel', status: 'waiting', detail: 'Awaiting approval before external send.' },
    { time: '10:17', title: 'Rebalanced model routing', agent: 'Summoner', status: 'done', detail: 'Moved coding tasks to MiniMax-M2.7 fallback lane.' },
    { time: '10:31', title: 'Building AgentOps dashboard', agent: 'Frontend Builder', status: 'running', detail: 'Rendering desktop and mobile command center.' }
  ],
  briefing: {
    news: [
      'Open-source agent runtimes are converging on durable workflows and MCP-native tool registries.',
      'Small teams are shipping internal AI copilots fastest when they expose costs, retries, and audit trails.',
      'Frontend polish is becoming a credibility signal for AI infra products.'
    ],
    reminders: [
      'Review active GitHub repos and archive stale public projects.',
      'Prepare SDE2 machine-coding drills: parking lot, splitwise, rate limiter.',
      'Ship one portfolio-visible agent workflow this week.'
    ],
    followUps: [
      { person: 'Recruiter inbox', topic: 'Check unread replies', age: '2h' },
      { person: 'X workflow', topic: 'Approve posting automation path', age: '1d' },
      { person: 'Portfolio', topic: 'Replace placeholder project screenshots', age: '3d' }
    ]
  },
  run: {
    id: 'run_jarvis_8249',
    agent: 'Summoner',
    objective: 'Coordinate daily operating loop for Personal AgentOS',
    model: 'MiniMax-M2.7 / GPT fallback',
    status: 'running',
    startedAt: '10:31 IST',
    tokens: '38.4k',
    cost: '$1.26',
    latency: '842ms',
    steps: [
      { label: 'Intent classified', state: 'complete' },
      { label: 'Tool graph resolved', state: 'complete' },
      { label: 'Worker tasks dispatched', state: 'active' },
      { label: 'User approval gates pending', state: 'pending' }
    ]
  },
  tools: {
    enabled: true,
    available: false,
    cli_path: '~/.composio/composio',
    tools: [
      { id: 'gmail.fetch', name: 'Gmail Fetch', description: 'Read recent Gmail messages through Composio.' },
      { id: 'gmail.search_unread', name: 'Unread Gmail Search', description: 'Read unread Gmail messages that may need follow-up.' }
    ],
    recent_runs: []
  }
};

async function fetchDashboard() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);

  try {
    const response = await fetch(`${API_URL}/api/dashboard`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { data: normalizeDashboard(data), source: 'backend' };
  } catch (error) {
    return { data: mockDashboard, source: 'mock', error: readableError(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRuns() {
  try {
    const response = await fetch(`${API_URL}/api/runs`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.runs || [];
  } catch {
    return [];
  }
}

async function responseError(response) {
  let detail = '';
  try {
    const data = await response.json();
    detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
  } catch {
    detail = await response.text().catch(() => '');
  }
  return new Error([`HTTP ${response.status}`, detail].filter(Boolean).join(': '));
}

function readableError(error) {
  if (error?.name === 'AbortError') return `Request timed out calling ${API_URL}`;
  return error?.message || 'Request failed';
}

function normalizeDashboard(data) {
  const metricIcons = [Bot, Workflow, Gauge, CircleDollarSign];
  return {
    metrics: data.metrics?.length
      ? data.metrics.map((metric, index) => ({ ...metric, icon: metricIcons[index % metricIcons.length] }))
      : mockDashboard.metrics,
    agents: data.agents?.length ? data.agents : mockDashboard.agents,
    timeline: data.timeline?.length ? data.timeline : mockDashboard.timeline,
    briefing: data.briefing || mockDashboard.briefing,
    run: data.run || data.selectedRun || mockDashboard.run,
    tools: data.tools || mockDashboard.tools
  };
}

function App() {
  const [dashboard, setDashboard] = useState(mockDashboard);
  const [source, setSource] = useState('mock');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(mockDashboard.agents[0].id);
  const [command, setCommand] = useState('');
  const [actionState, setActionState] = useState(null);
  const [activePage, setActivePage] = useState('overview');
  const [runs, setRuns] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [lastToolRun, setLastToolRun] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchDashboard().then((result) => {
      if (!alive) return;
      setDashboard(result.data);
      setSource(result.source);
      setSelectedAgentId(result.data.agents[0]?.id || mockDashboard.agents[0].id);
      if (result.error) {
        setActionState({ status: 'failed', message: `Backend unavailable: ${result.error}` });
      }
    });
    fetchRuns().then((items) => {
      if (alive) setRuns(items);
    });
    return () => { alive = false; };
  }, []);

  const selectedAgent = useMemo(
    () => dashboard.agents.find((agent) => agent.id === selectedAgentId) || dashboard.agents[0],
    [dashboard.agents, selectedAgentId]
  );

  async function refreshDashboard() {
    const result = await fetchDashboard();
    setDashboard(result.data);
    setSource(result.source);
    if (result.error) {
      setActionState({ status: 'failed', message: `Backend unavailable: ${result.error}` });
    }
    setRuns(await fetchRuns());
    return result;
  }

  async function handleSummon(event) {
    event.preventDefault();
    const message = command.trim() || 'Open the AgentOps dashboard and check connected tools.';
    setActionState({ status: 'running', message: 'Creating a local summon run...' });
    try {
      const response = await fetch(API_URL + '/api/summon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'dashboard', message, metadata: { ui: true } })
      });
      if (!response.ok) throw await responseError(response);
      const run = await response.json();
      setCommand('');
      setLastRun(run);
      setLastToolRun(null);
      await refreshDashboard();
      setActionState({ status: 'completed', message: `Summon completed: ${run.id}` });
    } catch (error) {
      setActionState({ status: 'failed', message: `Summon failed: ${readableError(error)}` });
    }
  }

  async function executeTool(toolId) {
    setActionState({ status: 'running', message: `Running ${toolId} through the backend...` });
    try {
      const response = await fetch(API_URL + '/api/tools/' + toolId + '/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: {} })
      });
      if (!response.ok) throw await responseError(response);
      const run = await response.json();
      setLastToolRun(run);
      await refreshDashboard();
      const message = run.status === 'completed'
        ? `${toolId} completed.`
        : `${toolId} could not run: ${run.error || 'tool returned an error'}`;
      setActionState({ status: run.status === 'completed' ? 'completed' : 'failed', message });
    } catch (error) {
      setActionState({ status: 'failed', message: `${toolId} failed: ${readableError(error)}` });
    }
  }

  function navigateToPage(pageId) {
    setActivePage(pageId);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="shell">
      <Sidebar open={sidebarOpen} activePage={activePage} onNavigate={navigateToPage} onClose={() => setSidebarOpen(false)} />
      <main className="main-frame">
        <TopBar onMenu={() => setSidebarOpen(true)} source={source} apiUrl={API_URL} />
        {activePage === 'overview' && (
          <OverviewPage
            dashboard={dashboard}
            command={command}
            actionState={actionState}
            lastRun={lastRun}
            lastToolRun={lastToolRun}
            onCommandChange={setCommand}
            onSummon={handleSummon}
            onExecute={executeTool}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgentId}
          />
        )}
        {activePage === 'agents' && <AgentsPage agents={dashboard.agents} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgentId} />}
        {activePage === 'runs' && <RunsPage run={dashboard.run} timeline={dashboard.timeline} runs={runs} />}
        {activePage === 'briefing' && <Briefing briefing={dashboard.briefing} />}
        {activePage === 'integrations' && (
          <section className="page-stack">
            <ToolPanel tools={dashboard.tools} onExecute={executeTool} />
            {actionState && <div className={'action-state ' + actionState.status}>{actionState.message}</div>}
            {lastToolRun && <ToolResultPanel toolRun={lastToolRun} />}
          </section>
        )}
        {activePage === 'approvals' && <ApprovalPanel tools={dashboard.tools} />}
      </main>
    </div>
  );
}

function OverviewPage({ dashboard, command, actionState, lastRun, lastToolRun, onCommandChange, onSummon, onExecute, selectedAgent, onSelectAgent }) {
  return (
    <>
      <section className="hero-grid">
        <div className="command-panel reveal">
          <div className="eyebrow"><RadioTower size={16} /> Personal AgentOS / Jarvis</div>
          <h1>AgentOps command center for your personal AI workforce.</h1>
          <p>Monitor live agents, inspect runs, track cost pressure, and keep the daily operating loop visible.</p>
          <form className="summon-bar" onSubmit={onSummon}>
            <Command size={20} />
            <span className="prompt">Summon:</span>
            <input aria-label="Summon command" placeholder="check gmail, brief me, route tasks..." value={command} onChange={(event) => onCommandChange(event.target.value)} />
            <button type="submit"><Sparkles size={18} /> Execute</button>
          </form>
          {actionState && <div className={'action-state ' + actionState.status}>{actionState.message}</div>}
        </div>
        <RunDetail run={dashboard.run} />
      </section>
      {(lastRun || lastToolRun) && <JarvisOutput run={lastRun} toolRun={lastToolRun} />}
      <MetricStrip metrics={dashboard.metrics} />
      <section className="content-grid">
        <AgentsPanel agents={dashboard.agents} selectedAgent={selectedAgent} onSelectAgent={onSelectAgent} />
        <TimelinePanel items={dashboard.timeline} />
      </section>
      <section className="lower-grid">
        <Briefing briefing={dashboard.briefing} />
        <ToolPanel tools={dashboard.tools} onExecute={onExecute} />
        <AgentInspector agent={selectedAgent} />
      </section>
    </>
  );
}

function JarvisOutput({ run, toolRun }) {
  const executeStep = run?.steps?.find((step) => step.name === 'execute workers');
  const selectedTools = executeStep?.output?.selected_composio_tools || [];
  const toolResults = executeStep?.output?.tool_results || [];
  return (
    <section className="panel jarvis-output reveal">
      <PanelHeader icon={Sparkles} title="Jarvis Output" action={run ? run.status : toolRun?.status} />
      {run && (
        <div className="output-summary">
          <strong>{run.summary}</strong>
          <span>{run.message}</span>
        </div>
      )}
      {!!selectedTools.length && (
        <div className="output-chips">
          {selectedTools.map((tool) => <span key={tool.id}>{tool.id}</span>)}
        </div>
      )}
      {toolResults.map((result) => <ToolResultPanel key={result.id} toolRun={result} />)}
      {toolRun && <ToolResultPanel toolRun={toolRun} />}
      {run && !toolResults.length && <p>Jarvis completed the internal graph. Ask for Gmail, unread email, or follow-ups to trigger Composio.</p>}
    </section>
  );
}

function ToolResultPanel({ toolRun }) {
  const messages = toolRun?.output?.data?.messages || [];
  const artifactPath = toolRun?.output?.outputFilePath;
  return (
    <div className="tool-result">
      <div className="tool-result-head">
        <strong>{toolRun.tool_id}</strong>
        <span className={toolRun.status}>{toolRun.status}</span>
      </div>
      {toolRun.error && <p>{toolRun.error}</p>}
      {!!messages.length && (
        <div className="message-list">
          {messages.slice(0, 5).map((message) => (
            <article key={message.messageId || `${message.sender}-${message.subject}`}>
              <strong>{message.subject || '(no subject)'}</strong>
              <span>{message.sender}</span>
              {message.preview?.body && <p>{message.preview.body}</p>}
            </article>
          ))}
        </div>
      )}
      {artifactPath && <p>Composio returned a large result and stored it at {artifactPath}</p>}
      {!messages.length && !artifactPath && !toolRun.error && <p>Tool completed. No message preview was returned.</p>}
    </div>
  );
}

function AgentsPage({ agents, selectedAgent, onSelectAgent }) {
  return (
    <section className="page-stack">
      <PageHeader icon={Bot} title="Agents" detail="Live backend agent registry and selected agent telemetry." />
      <AgentsPanel agents={agents} selectedAgent={selectedAgent} onSelectAgent={onSelectAgent} />
      <AgentInspector agent={selectedAgent} />
    </section>
  );
}

function RunsPage({ run, timeline, runs }) {
  return (
    <section className="page-stack">
      <PageHeader icon={Workflow} title="Runs" detail="Persisted summon runs from the backend." />
      <div className="content-grid">
        <RunDetail run={run} />
        <TimelinePanel items={timeline} />
      </div>
      <RunList runs={runs} />
    </section>
  );
}

function Sidebar({ open, activePage, onNavigate, onClose }) {
  const items = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'agents', icon: Bot, label: 'Agents' },
    { id: 'runs', icon: Workflow, label: 'Runs' },
    { id: 'briefing', icon: Newspaper, label: 'Briefing' },
    { id: 'integrations', icon: ServerCog, label: 'Integrations' },
    { id: 'approvals', icon: ShieldCheck, label: 'Approvals' }
  ];
  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Cpu size={22} /></div><div><strong>AgentOS</strong><span>JARVIS OPS</span></div></div>
        <nav>
          {items.map((item) => (
            <button className={activePage === item.id ? 'active' : ''} type="button" key={item.id} onClick={() => onNavigate(item.id)}>
              <item.icon size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><div className="pulse-dot" /><span>Control plane stable</span></div>
      </aside>
      {open && <button className="backdrop" aria-label="Close navigation" onClick={onClose} />}
    </>
  );
}

function TopBar({ onMenu, source, apiUrl }) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-only" type="button" onClick={onMenu} aria-label="Open navigation"><Menu size={21} /></button>
      <div className="topbar-search"><Search size={18} /><span>{apiUrl}</span></div>
      <div className="topbar-actions">
        <span className={`source-pill ${source}`}>{source === 'backend' ? 'API online' : 'Mock mode'}</span>
        <button className="icon-button" type="button" aria-label="Notifications" title="Placeholder: notifications are not wired yet"><BellRing size={19} /></button>
        <button className="icon-button" type="button" aria-label="Open command" title="Placeholder: command palette is not wired yet"><TerminalSquare size={19} /></button>
      </div>
    </header>
  );
}

function MetricStrip({ metrics }) {
  return (
    <section className="metric-strip reveal">
      {metrics.map((metric) => (
        <article className={`metric-card ${metric.tone}`} key={metric.label}>
          <metric.icon size={22} />
          <div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.delta}</small></div>
        </article>
      ))}
    </section>
  );
}

function PageHeader({ icon: Icon, title, detail }) {
  return (
    <section className="page-header">
      <div className="eyebrow"><Icon size={16} /> {title}</div>
      <h1>{title}</h1>
      <p>{detail}</p>
    </section>
  );
}

function AgentsPanel({ agents, selectedAgent, onSelectAgent }) {
  return (
    <div className="panel agents-panel reveal">
      <PanelHeader icon={Bot} title="Active Agents" action="Fleet health" />
      <div className="agents-grid">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} active={agent.id === selectedAgent?.id} onClick={() => onSelectAgent(agent.id)} />
        ))}
      </div>
    </div>
  );
}

function TimelinePanel({ items }) {
  return (
    <div className="panel reveal">
      <PanelHeader icon={Clock3} title="Running Task Timeline" action="Live trace" />
      <Timeline items={items} />
    </div>
  );
}

function AgentCard({ agent, active, onClick }) {
  return (
    <button className={`agent-card ${active ? 'selected' : ''}`} type="button" onClick={onClick}>
      <div className="agent-topline"><span className={`status ${agent.status}`}>{agent.status}</span><ArrowUpRight size={17} /></div>
      <h3>{agent.name}</h3>
      <p>{agent.role}</p>
      <div className="loadbar" aria-label={`${agent.load}% load`}><span style={{ width: `${agent.load}%` }} /></div>
      <div className="agent-stats">
        <span><Timer size={14} /> {agent.latency}ms</span>
        <span><CircleDollarSign size={14} /> ${agent.cost}</span>
        <span><Workflow size={14} /> {agent.tasks}</span>
      </div>
    </button>
  );
}

function Timeline({ items }) {
  return <div className="timeline">{items.map((item) => (<article className="timeline-item" key={`${item.time}-${item.title}`}><time>{item.time}</time><div className={`timeline-pin ${item.status}`} /><div><strong>{item.title}</strong><span>{item.agent}</span><p>{item.detail}</p></div></article>))}</div>;
}

function RunList({ runs }) {
  return (
    <section className="panel run-list-panel reveal">
      <PanelHeader icon={Workflow} title="Run History" action={`${runs.length} stored`} />
      <div className="run-list">
        {runs.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.message}</strong>
              <span>{item.source} / {item.created_at?.replace('T', ' ').slice(0, 16)}</span>
            </div>
            <small className={item.status}>{item.status}</small>
          </article>
        ))}
        {!runs.length && <p>No backend runs yet. Use Execute from Overview to create one.</p>}
      </div>
    </section>
  );
}

function Briefing({ briefing }) {
  return (
    <section className="panel briefing-panel reveal dashboard-section" id="briefing">
      <PanelHeader icon={Newspaper} title="Daily Briefing" action="News / reminders / follow-ups" />
      <div className="briefing-grid">
        <BriefingColumn icon={RadioTower} title="Signal" items={briefing.news} />
        <BriefingColumn icon={AlarmClock} title="Reminders" items={briefing.reminders} />
        <div className="briefing-column">
          <h3><MessageSquareText size={17} /> Follow-ups</h3>
          {briefing.followUps.map((item) => (<div className="followup" key={`${item.person}-${item.topic}`}><div><strong>{item.person}</strong><span>{item.topic}</span></div><small>{item.age}</small></div>))}
        </div>
      </div>
    </section>
  );
}

function BriefingColumn({ icon: Icon, title, items }) {
  return <div className="briefing-column"><h3><Icon size={17} /> {title}</h3>{items.map((item) => (<p key={item}><ChevronRight size={15} /> {item}</p>))}</div>;
}

function ToolPanel({ tools, onExecute }) {
  const available = tools?.available;
  const recentRuns = tools?.recent_runs || [];
  return (
    <section className="panel tool-panel reveal dashboard-section" id="integrations">
      <PanelHeader icon={ServerCog} title="Composio Tools" action={available ? 'CLI connected' : 'CLI offline'} />
      <div className={'tool-status ' + (available ? 'online' : 'offline')}>
        <span>{available ? 'Connected' : 'Waiting for local Composio CLI'}</span>
        <small>{tools?.cli_path}</small>
      </div>
      <div className="tool-list">
        {(tools?.tools || []).map((tool) => (
          <article className="tool-card" key={tool.id}>
            <div>
              <strong>{tool.name}</strong>
              <span>{tool.description}</span>
            </div>
            <button type="button" onClick={() => onExecute(tool.id)} title={available ? `Run ${tool.name}` : 'Run a backend check and record why Composio is unavailable'}>
              <Zap size={15} /> {available ? 'Run' : 'Check'}
            </button>
          </article>
        ))}
      </div>
      <div className="tool-runs">
        {recentRuns.slice(0, 4).map((run) => (
          <div key={run.id}>
            <span className={run.status}>{run.status}</span>
            <strong>{run.tool_id}</strong>
            <small>{run.created_at?.slice(11, 16)}</small>
          </div>
        ))}
        {!recentRuns.length && <p>No Composio tool runs yet.</p>}
      </div>
    </section>
  );
}

function ApprovalPanel({ tools }) {
  const readOnlyTools = (tools?.tools || []).filter((tool) => !tool.mutating);
  return (
    <section className="panel approvals-panel reveal dashboard-section" id="approvals">
      <PanelHeader icon={ShieldCheck} title="Approvals" action="Safety gates" />
      <div className="approval-grid">
        <div>
          <strong>Read-only tools can run from Jarvis</strong>
          <span>{readOnlyTools.length} Composio tools currently allowed: {readOnlyTools.map((tool) => tool.id).join(', ') || 'none'}</span>
        </div>
        <div>
          <strong>Mutating tools require explicit approval</strong>
          <span>Email sends, calendar writes, payments, or repo changes should stay blocked until an approval flow is added.</span>
        </div>
      </div>
    </section>
  );
}

function RunDetail({ run }) {
  return (
    <aside className="run-card reveal">
      <div className="run-header"><span className="status running">{run.status}</span><PanelRightOpen size={20} /></div>
      <h2>{run.id}</h2>
      <p>{run.objective}</p>
      <dl className="run-facts"><div><dt>Agent</dt><dd>{run.agent}</dd></div><div><dt>Model</dt><dd>{run.model}</dd></div><div><dt>Started</dt><dd>{run.startedAt}</dd></div><div><dt>Tokens</dt><dd>{run.tokens}</dd></div></dl>
      <div className="step-list">{run.steps.map((step) => (<div className={`run-step ${step.state}`} key={step.label}>{step.state === 'complete' ? <CheckCircle2 size={16} /> : <Activity size={16} />}<span>{step.label}</span></div>))}</div>
    </aside>
  );
}

function AgentInspector({ agent }) {
  if (!agent) return null;
  return (
    <section className="panel inspector-panel reveal">
      <PanelHeader icon={BrainCircuit} title="Agent Run Detail" action={agent.id} />
      <div className="inspector-core">
        <div className="orbital-meter" style={{ '--load': `${agent.load}%` }}><span>{agent.load}%</span></div>
        <div><h3>{agent.name}</h3><p>{agent.role}</p><div className="inspector-tags"><span><Zap size={14} /> {agent.status}</span><span><Timer size={14} /> {agent.latency}ms</span><span><GitBranch size={14} /> {agent.tasks} tasks</span></div></div>
      </div>
      <div className="terminal-log"><div><span>10:31:02</span> loaded worker context</div><div><span>10:31:04</span> resolved approval policy</div><div><span>10:31:08</span> streamed telemetry to dashboard</div></div>
    </section>
  );
}

function PanelHeader({ icon: Icon, title, action }) {
  return <div className="panel-header"><h2><Icon size={19} /> {title}</h2><span>{action}</span></div>;
}

createRoot(document.getElementById('root')).render(<App />);
