import { StrictMode, useEffect, useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitFork,
  GitPullRequest,
  Radio,
  ShieldAlert,
  TrendingUp,
  Zap,
} from "lucide-react";

type HazardLevel = "clear" | "watch" | "blocked";
type ActionPriority = "observe" | "next" | "urgent";
type ProjectPriority = "low" | "normal" | "high";
type RiskLevel = "low" | "medium" | "high";

type Summary = {
  projects: number;
  recentRuns: number;
  failedRuns: number;
  activeRuns: number;
  openAutopilotPulls: number;
  openIssues: number;
  blockedProjects: number;
  watchedProjects: number;
  clearProjects: number;
};

type Issue = {
  title: string;
  html_url: string;
  number: number;
  state: string;
  user?: { login?: string };
  labels?: Array<{ name?: string }>;
  created_at: string;
  updated_at: string;
};

type RepoAction = {
  repo: string;
  priority: ActionPriority;
  reason: string;
  command: string;
  links: string[];
};

type RepoField = {
  repo: string;
  priority: ProjectPriority;
  risk: RiskLevel;
  workflowNames: string[];
  owners: string[];
  allowedActions: string[];
  deploy?: {
    environment?: string;
    policy?: string;
    url?: string;
  };
  signals: {
    latestRun: {
      id: number;
      runNumber: number;
      conclusion: string | null;
      status: string;
      branch: string | null;
      createdAt: string;
      url: string;
      durationSeconds: number | null;
    } | null;
    recentRuns: number;
    failedRuns: number;
    activeRuns: number;
    openAutopilotPulls: number;
    openIssues: number;
    collectionErrors: number;
  };
  currentIssues: Issue[];
  hazards: string[];
  hazardLevel: HazardLevel;
  drift: {
    previousGeneratedAt: string | null;
    latestRunChanged: boolean | null;
    openPullDelta: number | null;
    failureDelta: number | null;
    hazardChanged: boolean | null;
  };
  routes: string[];
  actions: RepoAction[];
};

type FieldMap = {
  generatedAt: string;
  metaphor: "geomagnetic-navigation-field";
  summary: Summary;
  projects: RepoField[];
  actions: RepoAction[];
};

type ActionPlan = {
  generatedAt: string;
  actions: RepoAction[];
};

type HistoryProject = {
  repo: string;
  hazardLevel: HazardLevel;
  failedRuns: number;
  activeRuns: number;
  openAutopilotPulls: number;
  openIssues: number;
  latestRunId: number | null;
  actionPriorities: ActionPriority[];
};

type HistorySnapshot = {
  generatedAt: string;
  summary: Summary;
  projects: HistoryProject[];
};

type HistoryOutput = {
  generatedAt: string;
  retentionDays: number;
  snapshots: HistorySnapshot[];
};

type DataState = {
  loading: boolean;
  fieldMap: FieldMap | null;
  actionPlan: ActionPlan | null;
  history: HistoryOutput | null;
  errors: string[];
};

const DATA_FILES = {
  field: "geodynamo-field-map.json",
  plan: "geodynamo-action-plan.json",
  history: "geodynamo-history.json",
};

const EMPTY_SUMMARY: Summary = {
  projects: 0,
  recentRuns: 0,
  failedRuns: 0,
  activeRuns: 0,
  openAutopilotPulls: 0,
  openIssues: 0,
  blockedProjects: 0,
  watchedProjects: 0,
  clearProjects: 0,
};

function App() {
  const [data, setData] = useState<DataState>({
    loading: true,
    fieldMap: null,
    actionPlan: null,
    history: null,
    errors: [],
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [field, plan, history] = await Promise.all([
        loadJson<FieldMap>(DATA_FILES.field),
        loadJson<ActionPlan>(DATA_FILES.plan),
        loadJson<HistoryOutput>(DATA_FILES.history),
      ]);

      if (!mounted) return;

      setData({
        loading: false,
        fieldMap: field.value,
        actionPlan: plan.value,
        history: history.value,
        errors: [field.error, plan.error, history.error].filter((error): error is string => Boolean(error)),
      });
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const summary = data.fieldMap?.summary ?? EMPTY_SUMMARY;
  const actions = data.actionPlan?.actions ?? data.fieldMap?.actions ?? [];
  const generatedAt = data.fieldMap?.generatedAt ?? data.actionPlan?.generatedAt ?? data.history?.generatedAt ?? null;

  return (
    <main className="shell">
      <Header generatedAt={generatedAt} />

      {data.loading ? <LoadingState /> : null}

      {!data.loading && data.errors.length > 0 ? <DataWarnings errors={data.errors} /> : null}

      {!data.loading && !data.fieldMap ? <MissingData /> : null}

      {data.fieldMap ? (
        <>
          <SummaryStrip summary={summary} />
          <div className="dashboard-grid">
            <ActionQueue actions={actions} />
            <TrendPanel history={data.history} current={data.fieldMap} />
          </div>
          <ProjectRows projects={data.fieldMap.projects} />
        </>
      ) : null}
    </main>
  );
}

async function loadJson<T>(path: string): Promise<{ value: T | null; error: string | null }> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      return { value: null, error: `${path}: ${response.status} ${response.statusText}` };
    }
    return { value: await response.json() as T, error: null };
  } catch (error) {
    return { value: null, error: `${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function Header({ generatedAt }: { generatedAt: string | null }) {
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">
          <Radio size={16} aria-hidden="true" />
          Caretta field state
        </div>
        <h1>Geodynamo</h1>
      </div>
      <div className="topbar-meta">
        <span className="read-only">
          <ShieldAlert size={16} aria-hidden="true" />
          Read-only
        </span>
        <span>{generatedAt ? formatDateTime(generatedAt) : "No generation timestamp"}</span>
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <section className="panel state-panel" aria-live="polite">
      <Activity size={18} aria-hidden="true" />
      Loading field data
    </section>
  );
}

function MissingData() {
  return (
    <section className="panel state-panel">
      <AlertTriangle size={18} aria-hidden="true" />
      Field map JSON is unavailable. The workflow has not published dashboard data yet.
    </section>
  );
}

function DataWarnings({ errors }: { errors: string[] }) {
  return (
    <section className="panel warning-panel">
      <div className="section-title">
        <AlertTriangle size={18} aria-hidden="true" />
        Data warnings
      </div>
      <div className="warning-list">
        {errors.map((error) => (
          <code key={error}>{error}</code>
        ))}
      </div>
    </section>
  );
}

function SummaryStrip({ summary }: { summary: Summary }) {
  const cards = [
    { label: "Projects", value: summary.projects, icon: <GitFork size={18} />, tone: "neutral" },
    { label: "Blocked", value: summary.blockedProjects, icon: <ShieldAlert size={18} />, tone: "blocked" },
    { label: "Watch", value: summary.watchedProjects, icon: <AlertTriangle size={18} />, tone: "watch" },
    { label: "Clear", value: summary.clearProjects, icon: <CheckCircle2 size={18} />, tone: "clear" },
    { label: "Failed runs", value: summary.failedRuns, icon: <Zap size={18} />, tone: "blocked" },
    { label: "Active runs", value: summary.activeRuns, icon: <Clock3 size={18} />, tone: "active" },
    { label: "Open PRs", value: summary.openAutopilotPulls, icon: <GitPullRequest size={18} />, tone: "pr" },
    { label: "Issues", value: summary.openIssues ?? 0, icon: <AlertTriangle size={18} />, tone: "issue" },
  ] as const;

  return (
    <section className="metric-grid" aria-label="Fleet summary">
      {cards.map((card) => (
        <article className={`metric metric-${card.tone}`} key={card.label}>
          <div className="metric-icon" aria-hidden="true">{card.icon}</div>
          <div>
            <div className="metric-value">{card.value}</div>
            <div className="metric-label">{card.label}</div>
          </div>
        </article>
      ))}
    </section>
  );
}

function ActionQueue({ actions }: { actions: RepoAction[] }) {
  const grouped = useMemo(() => ({
    urgent: actions.filter((action) => action.priority === "urgent"),
    next: actions.filter((action) => action.priority === "next"),
    observe: actions.filter((action) => action.priority === "observe"),
  }), [actions]);

  return (
    <section className="panel action-panel">
      <div className="section-title">
        <Zap size={18} aria-hidden="true" />
        Action queue
      </div>
      <div className="action-columns">
        <ActionColumn title="Urgent" tone="urgent" actions={grouped.urgent} />
        <ActionColumn title="Next" tone="next" actions={grouped.next} />
        <ActionColumn title="Observe" tone="observe" actions={grouped.observe} />
      </div>
    </section>
  );
}

function ActionColumn({ title, tone, actions }: { title: string; tone: ActionPriority; actions: RepoAction[] }) {
  return (
    <div className={`action-column action-${tone}`}>
      <div className="column-heading">
        <span>{title}</span>
        <strong>{actions.length}</strong>
      </div>
      {actions.length === 0 ? (
        <p className="empty-copy">No items</p>
      ) : (
        <div className="action-list">
          {actions.map((action, index) => (
            <article className="action-item" key={`${action.repo}-${action.priority}-${index}`}>
              <a href={githubRepoUrl(action.repo)} className="repo-link">{action.repo}</a>
              <p>{action.command}</p>
              <small>{action.reason}</small>
              <LinkStrip links={action.links} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendPanel({ history, current }: { history: HistoryOutput | null; current: FieldMap }) {
  const snapshots = history?.snapshots ?? [];
  const timeline = snapshots.length > 0 ? snapshots : [historyFromCurrent(current)];
  const latest = timeline[timeline.length - 1] ?? historyFromCurrent(current);
  const maxRuns = Math.max(1, ...timeline.map((snapshot) => snapshot.summary.failedRuns + snapshot.summary.activeRuns));

  return (
    <section className="panel trend-panel">
      <div className="section-title">
        <TrendingUp size={18} aria-hidden="true" />
        {history?.retentionDays ?? 30}-day trend
      </div>
      {snapshots.length === 0 ? (
        <p className="empty-copy trend-empty">No persisted history yet. Current field state is shown as the baseline.</p>
      ) : null}
      <div className="trend-summary">
        <StatusPill level="blocked" label={`${latest.summary.blockedProjects} blocked`} />
        <StatusPill level="watch" label={`${latest.summary.watchedProjects} watch`} />
        <StatusPill level="clear" label={`${latest.summary.clearProjects} clear`} />
      </div>
      <div className="trend-list">
        {timeline.slice(-30).map((snapshot) => (
          <TrendRow key={snapshot.generatedAt} snapshot={snapshot} maxRuns={maxRuns} />
        ))}
      </div>
    </section>
  );
}

function TrendRow({ snapshot, maxRuns }: { snapshot: HistorySnapshot; maxRuns: number }) {
  const projects = Math.max(1, snapshot.summary.projects);
  const blockedWidth = `${Math.round((snapshot.summary.blockedProjects / projects) * 100)}%`;
  const watchWidth = `${Math.round((snapshot.summary.watchedProjects / projects) * 100)}%`;
  const clearWidth = `${Math.round((snapshot.summary.clearProjects / projects) * 100)}%`;
  const runPressure = snapshot.summary.failedRuns + snapshot.summary.activeRuns;
  const pressureWidth = `${Math.max(4, Math.round((runPressure / maxRuns) * 100))}%`;

  return (
    <div className="trend-row">
      <time dateTime={snapshot.generatedAt}>{formatShortDate(snapshot.generatedAt)}</time>
      <div className="trend-bars" aria-label={`${snapshot.summary.blockedProjects} blocked, ${snapshot.summary.watchedProjects} watch, ${snapshot.summary.clearProjects} clear`}>
        <div className="status-bar">
          <span className="bar-blocked" style={{ width: blockedWidth }} />
          <span className="bar-watch" style={{ width: watchWidth }} />
          <span className="bar-clear" style={{ width: clearWidth }} />
        </div>
        <div className="pressure-track">
          <span style={{ width: pressureWidth }} />
        </div>
      </div>
      <span className="trend-count">{runPressure} run pressure</span>
    </div>
  );
}

function ProjectRows({ projects }: { projects: RepoField[] }) {
  return (
    <section className="projects-section">
      <div className="section-title">
        <GitFork size={18} aria-hidden="true" />
        Project status
      </div>
      <div className="project-list">
        {projects.map((project) => (
          <ProjectCard key={project.repo} project={project} />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: RepoField }) {
  const latest = project.signals.latestRun;
  const actionLinks = project.actions.flatMap((action) => action.links).slice(0, 4);

  return (
    <article className={`project-card project-${project.hazardLevel}`}>
      <div className="project-main">
        <div className="project-heading">
          <a href={githubRepoUrl(project.repo)} className="repo-title">
            <GitFork size={18} aria-hidden="true" />
            {project.repo}
          </a>
          <div className="project-badges">
            <StatusPill level={project.hazardLevel} label={project.hazardLevel} />
            <span className="soft-pill">{project.priority} priority</span>
            <span className="soft-pill">{project.risk} risk</span>
          </div>
        </div>

        <div className="signal-grid">
          <Signal label="Recent" value={project.signals.recentRuns} />
          <Signal label="Failed" value={project.signals.failedRuns} />
          <Signal label="Active" value={project.signals.activeRuns} />
          <Signal label="PRs" value={project.signals.openAutopilotPulls} />
          <Signal label="Issues" value={project.signals.openIssues} />
          <Signal label="Errors" value={project.signals.collectionErrors} />
        </div>

        <div className="detail-grid">
          <Detail label="Latest run">
            {latest ? (
              <a href={latest.url} className="inline-link">
                #{latest.runNumber} {latest.conclusion ?? latest.status}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : "None"}
          </Detail>
          <Detail label="Branch">{latest?.branch ?? "n/a"}</Detail>
          <Detail label="Drift">{formatDrift(project.drift)}</Detail>
          <Detail label="Workflow">{project.workflowNames.join(", ")}</Detail>
        </div>
      </div>

      <div className="project-side">
        <TagGroup title="Hazards" values={project.hazards} empty="none" />
        <TagGroup title="Routes" values={project.routes.slice(0, 2)} empty="normal cadence" />
        <IssueList issues={project.currentIssues ?? []} />
        <LinkStrip links={actionLinks} />
      </div>
    </article>
  );
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <div className="signal">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function TagGroup({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return (
    <div className="tag-group">
      <span>{title}</span>
      <div>
        {values.length === 0 ? <em>{empty}</em> : values.map((value) => <code key={value}>{value}</code>)}
      </div>
    </div>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <div className="issue-list">
      <span>Current issues</span>
      {issues.length === 0 ? (
        <em>none</em>
      ) : (
        <div>
          {issues.slice(0, 4).map((issue) => (
            <a href={issue.html_url} key={issue.html_url} className="issue-link">
              <strong>#{issue.number}</strong>
              <span>{issue.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkStrip({ links }: { links: string[] }) {
  if (links.length === 0) return null;

  return (
    <div className="link-strip">
      {links.slice(0, 4).map((link, index) => (
        <a href={link} key={`${link}-${index}`} title={link} aria-label={link}>
          {linkLabel(link, index)}
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

function StatusPill({ level, label }: { level: HazardLevel; label: string }) {
  return <span className={`status-pill status-${level}`}>{label}</span>;
}

function historyFromCurrent(fieldMap: FieldMap): HistorySnapshot {
  return {
    generatedAt: fieldMap.generatedAt,
    summary: fieldMap.summary,
    projects: fieldMap.projects.map((project) => ({
      repo: project.repo,
      hazardLevel: project.hazardLevel,
      failedRuns: project.signals.failedRuns,
      activeRuns: project.signals.activeRuns,
      openAutopilotPulls: project.signals.openAutopilotPulls,
      openIssues: project.signals.openIssues ?? 0,
      latestRunId: project.signals.latestRun?.id ?? null,
      actionPriorities: compactActionPriorities(project.actions),
    })),
  };
}

function compactActionPriorities(actions: RepoAction[]): ActionPriority[] {
  const order: ActionPriority[] = ["urgent", "next", "observe"];
  return order.filter((priority) => actions.some((action) => action.priority === priority));
}

function githubRepoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}

function linkLabel(link: string, index: number): string {
  if (link.includes("/actions/runs/")) return "Run";
  if (link.includes("/pull/")) return "PR";
  if (link.includes("/issues/")) return "Issue";
  return `Link ${index + 1}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
  }).format(date);
}

function formatDelta(value: number | null): string {
  if (value === null) return "baseline";
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatDrift(drift: RepoField["drift"]): string {
  if (!drift.previousGeneratedAt) return "baseline";
  const latest = drift.latestRunChanged ? "run changed" : "run steady";
  const hazard = drift.hazardChanged ? "hazard changed" : "hazard steady";
  return `${latest}, ${hazard}, PR ${formatDelta(drift.openPullDelta)}, failed ${formatDelta(drift.failureDelta)}`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
