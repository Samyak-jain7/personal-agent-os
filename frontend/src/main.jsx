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

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  } catch {
    return { data: mockDashboard, source: 'mock' };
  } finally {
    clearTimeout(timeout);
  }
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
  const [summonStatus, setSummonStatus] = useState('');

  useEffect(() => {
    let alive = true;
    fetchDashboard().then((result) => {
      if (!alive) return;
      setDashboard(result.data);
      setSource(result.source);
      setSelectedAgentId(result.data.agents[0]?.id || mockDashboard.agents[0].id);
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
  }

  async function handleSummon(event) {
    event.preventDefault();
    const message = command.trim() || 'Open the AgentOps dashboard and check connected tools.';
    setSummonStatus('running');
    try {
      const response = await fetch(API_URL + '/api/summon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'dashboard', message, metadata: { ui: true } })
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      setCommand('');
      setSummonStatus('completed');
      await refreshDashboard();
    } catch {
      setSummonStatus('failed');
    }
  }

  async function executeTool(toolId) {
    setSummonStatus('running');
    try {
      const response = await fetch(API_URL + '/api/tools/' + toolId + '/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: {} })
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      setSummonStatus('completed');
      await refreshDashboard();
    } catch {
      setSummonStatus('failed');
    }
  }

  return (
    <div className="shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-frame">
        <TopBar onMenu={() => setSidebarOpen(true)} source={source} />
        <section className="hero-grid">
          <div className="command-panel reveal">
            <div className="eyebrow"><RadioTower size={16} /> Personal AgentOS / Jarvis</div>
            <h1>AgentOps command center for your personal AI workforce.</h1>
            <p>Monitor live agents, inspect runs, track cost pressure, and keep the daily operating loop visible.</p>
            <form className="summon-bar" onSubmit={handleSummon}>
              <Command size={20} />
              <span className="prompt">Summon:</span>
              <input aria-label="Summon command" placeholder="check gmail, brief me, route tasks..." value={command} onChange={(event) => setCommand(event.target.value)} />
              <button type="submit"><Sparkles size={18} /> Execute</button>
            </form>
            {summonStatus && <div className={'action-state ' + summonStatus}>{summonStatus}</div>}
          </div>
          <RunDetail run={dashboard.run} />
        </section>
        <MetricStrip metrics={dashboard.metrics} />
        <section className="content-grid">
          <div className="panel agents-panel reveal">
            <PanelHeader icon={Bot} title="Active Agents" action="Fleet health" />
            <div className="agents-grid">
              {dashboard.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} active={agent.id === selectedAgent?.id} onClick={() => setSelectedAgentId(agent.id)} />
              ))}
            </div>
          </div>
          <div className="panel reveal">
            <PanelHeader icon={Clock3} title="Running Task Timeline" action="Live trace" />
            <Timeline items={dashboard.timeline} />
          </div>
        </section>
        <section className="lower-grid">
          <Briefing briefing={dashboard.briefing} />
          <ToolPanel tools={dashboard.tools} onExecute={executeTool} />
          <AgentInspector agent={selectedAgent} />
        </section>
      </main>
    </div>
  );
}

function Sidebar({ open, onClose }) {
  const items = [
    { icon: LayoutDashboard, label: 'Overview', active: true },
    { icon: Bot, label: 'Agents' },
    { icon: Workflow, label: 'Runs' },
    { icon: Newspaper, label: 'Briefing' },
    { icon: ServerCog, label: 'Integrations' },
    { icon: ShieldCheck, label: 'Approvals' }
  ];
  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Cpu size={22} /></div><div><strong>AgentOS</strong><span>JARVIS OPS</span></div></div>
        <nav>{items.map((item) => (<a className={item.active ? 'active' : ''} href="#" key={item.label}><item.icon size={19} /><span>{item.label}</span></a>))}</nav>
        <div className="sidebar-footer"><div className="pulse-dot" /><span>Control plane stable</span></div>
      </aside>
      {open && <button className="backdrop" aria-label="Close navigation" onClick={onClose} />}
    </>
  );
}

function TopBar({ onMenu, source }) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-only" type="button" onClick={onMenu} aria-label="Open navigation"><Menu size={21} /></button>
      <div className="topbar-search"><Search size={18} /><span>Search agents, runs, memories, approvals</span></div>
      <div className="topbar-actions">
        <span className={`source-pill ${source}`}>{source === 'backend' ? 'API online' : 'Mock mode'}</span>
        <button className="icon-button" type="button" aria-label="Notifications"><BellRing size={19} /></button>
        <button className="icon-button" type="button" aria-label="Open command"><TerminalSquare size={19} /></button>
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

function Briefing({ briefing }) {
  return (
    <section className="panel briefing-panel reveal">
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
    <section className="panel tool-panel reveal">
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
            <button type="button" onClick={() => onExecute(tool.id)} disabled={!available}>
              <Zap size={15} /> Run
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
