import { Codex, type ModelReasoningEffort } from "@openai/codex-sdk";
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";

type RepoSlug = `${string}/${string}`;
type Priority = "low" | "normal" | "high";
type RiskLevel = "low" | "medium" | "high";
type HazardLevel = "clear" | "watch" | "blocked";
type ActionPriority = "observe" | "next" | "urgent";

type ProjectDescriptor = {
  repo: RepoSlug;
  priority: Priority;
  risk: RiskLevel;
  workflowNames: string[];
  owners: string[];
  allowedActions: string[];
  factoryContext: string[];
  deploy?: {
    environment?: string;
    policy?: string;
    url?: string;
  };
};

type Options = {
  projects: ProjectDescriptor[];
  factoryContext: FactoryContextConfig;
  coreContextPath: string;
  configPath: string;
  workflowName: string;
  limit: number;
  days: number;
  model?: string;
  reasoning: ModelReasoningEffort;
  output?: string;
  jsonOutput?: string;
  fieldOutput?: string;
  planOutput?: string;
  historyOutput?: string;
  contextsOutput?: string;
  statePath?: string;
  noState: boolean;
  noCodex: boolean;
  failOnCodexError: boolean;
};

type ConfigFile = {
  projects?: Array<string | ConfigProject>;
  repos?: string[];
  factoryContext?: FactoryContextConfig;
  coreContextPath?: string;
  workflowName?: string;
  limit?: number;
  days?: number;
  statePath?: string;
};

type FactoryContextConfig = {
  summary?: string;
  guidance?: string[];
};

type ConfigProject = {
  repo?: string;
  priority?: string;
  risk?: string;
  workflowName?: string;
  workflowNames?: string[];
  owners?: string[];
  allowedActions?: string[];
  factoryContext?: string | string[];
  deploy?: {
    environment?: string;
    policy?: string;
    url?: string;
  };
};

type WorkflowRun = {
  id: number;
  name: string | null;
  path: string;
  display_title: string;
  run_number: number;
  event: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string | null;
  head_branch: string | null;
  head_sha: string;
  head_commit?: {
    message?: string;
    author?: { name?: string; email?: string };
  };
  actor?: { login?: string };
  jobs_url: string;
};

type Job = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  started_at: string | null;
  completed_at: string | null;
  steps?: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    number: number;
    started_at: string | null;
    completed_at: string | null;
  }>;
};

type PullRequest = {
  title: string;
  html_url: string;
  number: number;
  state: string;
  user?: { login?: string };
  created_at: string;
  updated_at: string;
  auto_merge?: unknown;
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
  pull_request?: unknown;
};

type RepoReport = {
  repo: RepoSlug;
  project: ProjectDescriptor;
  generatedAt: string;
  runs: Array<WorkflowRun & { durationSeconds: number | null; jobs: Job[] }>;
  openAutopilotPulls: PullRequest[];
  openIssues: Issue[];
  errors: string[];
};

type Snapshot = {
  generatedAt: string;
  workflowName: string;
  repos: RepoReport[];
};

type PreviousRepoState = {
  repo: RepoSlug;
  generatedAt: string;
  latestRunId: number | null;
  latestRunConclusion: string | null;
  latestRunCreatedAt: string | null;
  openPullCount: number;
  failureCount: number;
  hazardLevel: HazardLevel;
};

type RepoAction = {
  repo: RepoSlug;
  priority: ActionPriority;
  reason: string;
  command: string;
  links: string[];
};

type RepoField = {
  repo: RepoSlug;
  priority: Priority;
  risk: RiskLevel;
  workflowNames: string[];
  owners: string[];
  allowedActions: string[];
  factoryContext: string[];
  deploy?: ProjectDescriptor["deploy"];
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
  summary: {
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
  projects: RepoField[];
  actions: RepoAction[];
};

type HistoryProject = {
  repo: RepoSlug;
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
  summary: FieldMap["summary"];
  projects: HistoryProject[];
};

type HistoryOutput = {
  generatedAt: string;
  retentionDays: number;
  snapshots: HistorySnapshot[];
};

type ProjectContextOutput = {
  schema: "geodynamo.project-context.v1";
  generatedAt: string;
  scope: "caretta-factory-cycle-only";
  source: "geodynamo";
  repo: RepoSlug;
  projectName: string;
  coreContextPath: string;
  context: string;
  title: string;
  featureSets: string[];
  rationale: string;
  guardrails: string[];
  priority: Priority;
  risk: RiskLevel;
  hazardLevel: HazardLevel;
  hazards: string[];
  signals: RepoField["signals"];
  routes: string[];
  actions: RepoAction[];
};

type CodexProjectContext = {
  repo: string;
  context: string;
  title?: string;
  featureSets?: unknown;
  rationale?: string;
  guardrails?: unknown;
};

type CodexProjectContextsResponse = {
  projects: CodexProjectContext[];
};

const DEFAULT_PROJECTS: ProjectDescriptor[] = [
  createProjectDescriptor("geoffsee/cortex-enigma"),
  createProjectDescriptor("geoffsee/midi-vibe"),
  createProjectDescriptor("geoffsee/bevy-osc-app"),
];

const CARETTA_IDENTIFIERS = [
  "caretta-autopilot",
  "github-actions[bot]",
  "claude",
  "autopilot",
];

const DEFAULT_CONFIG_PATH = "geodynamo-projects.json";
const DEFAULT_CORE_CONTEXT_PATH = "geodynamo-core-context.md";
const DEFAULT_STATE_PATH = "geodynamo-state.sqlite";
const HISTORY_RETENTION_DAYS = 30;

async function parseArgs(argv: string[]): Promise<Options> {
  const preflight = parseConfigPath(argv);
  const config = await loadConfig(preflight.configPath);
  const options: Options = {
    projects: parseConfigProjects(config, preflight.configPath),
    factoryContext: parseFactoryContextConfig(config.factoryContext),
    coreContextPath: config.coreContextPath ?? DEFAULT_CORE_CONTEXT_PATH,
    configPath: preflight.configPath,
    workflowName: config.workflowName ?? "Autopilot",
    limit: config.limit ?? 5,
    days: config.days ?? 7,
    statePath: config.statePath ?? DEFAULT_STATE_PATH,
    reasoning: "medium",
    noState: false,
    noCodex: false,
    failOnCodexError: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value;
    };

    switch (arg) {
      case "--config":
        next();
        break;
      case "--repo":
        options.projects.push(createProjectDescriptor(parseRepo(next()), options.workflowName));
        break;
      case "--repos":
        options.projects = next()
          .split(",")
          .map((repo) => createProjectDescriptor(parseRepo(repo.trim()), options.workflowName));
        break;
      case "--workflow":
        options.workflowName = next();
        options.projects = options.projects.map((project) => ({
          ...project,
          workflowNames: uniqueStrings([options.workflowName, ...project.workflowNames]),
        }));
        break;
      case "--limit":
        options.limit = parsePositiveInteger(next(), "--limit");
        break;
      case "--days":
        options.days = parsePositiveInteger(next(), "--days");
        break;
      case "--model":
        options.model = next();
        break;
      case "--reasoning":
        options.reasoning = parseReasoning(next());
        break;
      case "--output":
        options.output = next();
        break;
      case "--json-output":
        options.jsonOutput = next();
        break;
      case "--field-output":
        options.fieldOutput = next();
        break;
      case "--plan-output":
        options.planOutput = next();
        break;
      case "--history-output":
        options.historyOutput = next();
        break;
      case "--contexts-output":
        options.contextsOutput = next();
        break;
      case "--core-context":
        options.coreContextPath = next();
        break;
      case "--state":
        options.statePath = next();
        break;
      case "--no-state":
        options.noState = true;
        break;
      case "--no-codex":
        options.noCodex = true;
        break;
      case "--fail-on-codex-error":
        options.failOnCodexError = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.projects = dedupeProjects(options.projects);
  return options;
}

function parseRepo(value: string): RepoSlug {
  if (!/^[^/\s]+\/[^/\s]+$/.test(value)) {
    throw new Error(`Invalid repo slug: ${value}`);
  }
  return value as RepoSlug;
}

function parseConfigPath(argv: string[]): { configPath: string } {
  const configFlagIndex = argv.indexOf("--config");
  if (configFlagIndex === -1) {
    return {
      configPath: process.env.GEODYNAMO_CONFIG ?? DEFAULT_CONFIG_PATH,
    };
  }

  const configPath = argv[configFlagIndex + 1];
  if (!configPath || configPath.startsWith("--")) {
    throw new Error("Missing value for --config");
  }
  return { configPath };
}

async function loadConfig(path: string): Promise<ConfigFile> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    if (path === DEFAULT_CONFIG_PATH) {
      return { projects: DEFAULT_PROJECTS };
    }
    throw new Error(`Config file not found: ${path}`);
  }

  const parsed = await file.json() as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Config file must contain a JSON object: ${path}`);
  }

  return parsed as ConfigFile;
}

function parseConfigProjects(config: ConfigFile, configPath: string): ProjectDescriptor[] {
  if (config.projects && config.projects.length > 0) {
    return config.projects.map((project) => parseConfigProject(project, config.workflowName ?? "Autopilot"));
  }

  if (config.repos && config.repos.length > 0) {
    return config.repos.map((repo) => createProjectDescriptor(parseRepo(repo), config.workflowName ?? "Autopilot"));
  }

  throw new Error(`Config file must include at least one project in "projects" or repo in "repos": ${configPath}`);
}

function parseConfigProject(project: string | ConfigProject, defaultWorkflowName: string): ProjectDescriptor {
  if (typeof project === "string") {
    return createProjectDescriptor(parseRepo(project), defaultWorkflowName);
  }

  if (!project || typeof project !== "object" || !project.repo) {
    throw new Error("Each project must be an owner/repo string or an object with a repo field");
  }

  const workflowNames = uniqueStrings([
    project.workflowName,
    ...(project.workflowNames ?? []),
    defaultWorkflowName,
  ].filter((value): value is string => Boolean(value)));

  return {
    repo: parseRepo(project.repo),
    priority: parsePriority(project.priority),
    risk: parseRisk(project.risk),
    workflowNames,
    owners: project.owners ?? [],
    allowedActions: project.allowedActions ?? ["observe", "report"],
    factoryContext: normalizeStringList(project.factoryContext, "project.factoryContext"),
    deploy: project.deploy,
  };
}

function createProjectDescriptor(repo: RepoSlug, workflowName = "Autopilot"): ProjectDescriptor {
  return {
    repo,
    priority: "normal",
    risk: "medium",
    workflowNames: [workflowName],
    owners: [],
    allowedActions: ["observe", "report"],
    factoryContext: [],
  };
}

function parseFactoryContextConfig(value: FactoryContextConfig | undefined): FactoryContextConfig {
  if (!value) return { guidance: [] };
  return {
    summary: typeof value.summary === "string" ? value.summary.trim() : undefined,
    guidance: normalizeStringList(value.guidance, "factoryContext.guidance"),
  };
}

function normalizeStringList(value: string | string[] | undefined, name: string): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${name} entries must be strings`);
    }
    return item.trim();
  }).filter((item) => item.length > 0);
}

function parsePriority(value: string | undefined): Priority {
  if (!value) return "normal";
  if (value === "low" || value === "normal" || value === "high") return value;
  throw new Error(`Project priority must be one of: low, normal, high`);
}

function parseRisk(value: string | undefined): RiskLevel {
  if (!value) return "medium";
  if (value === "low" || value === "medium" || value === "high") return value;
  throw new Error(`Project risk must be one of: low, medium, high`);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function dedupeProjects(projects: ProjectDescriptor[]): ProjectDescriptor[] {
  const deduped = new Map<RepoSlug, ProjectDescriptor>();
  for (const project of projects) {
    deduped.set(project.repo, project);
  }
  return [...deduped.values()];
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function parseReasoning(value: string): ModelReasoningEffort {
  const allowed = ["minimal", "low", "medium", "high", "xhigh"];
  if (!allowed.includes(value)) {
    throw new Error(`--reasoning must be one of: ${allowed.join(", ")}`);
  }
  return value as ModelReasoningEffort;
}

function printHelp() {
  console.log(`Geodynamo Caretta navigation field

Usage:
  bun run report [options]

Options:
  --config path                   Project config, default: geodynamo-projects.json
  --repos owner/name,owner/name   Replace configured repos for this run
  --repo owner/name               Add a repo to configured repos for this run
  --workflow name                 Workflow name to filter, default: Autopilot
  --limit n                       Recent workflow runs per repo, default: 5
  --days n                        Lookback window in days, default: 7
  --model model                   Codex model override
  --reasoning level               minimal, low, medium, high, xhigh
  --output path                   Write markdown report to a file
  --json-output path              Write collected GitHub snapshot to a file
  --field-output path             Write agent field map JSON to a file
  --plan-output path              Write action plan JSON to a file
  --history-output path           Write compact field history JSON to a file
  --contexts-output dir           Write Caretta project contexts under dir/<project-name>/context.json
  --core-context path             Markdown policy used by Codex for project contexts
  --state path                    SQLite state path, default: geodynamo-state.sqlite
  --no-state                      Do not read or write durable state
  --no-codex                      Skip Codex SDK and emit deterministic report
  --fail-on-codex-error           Exit non-zero if Codex report generation fails
`);
}

async function githubGet<T>(url: string): Promise<T> {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "geodynamo-caretta-navigation",
    "X-GitHub-Api-Version": "2022-11-28",
  });

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub request failed ${response.status} ${response.statusText}: ${url}\n${detail}`);
  }

  return await response.json() as T;
}

async function collectRepo(project: ProjectDescriptor, options: Options): Promise<RepoReport> {
  const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
  const report: RepoReport = {
    repo: project.repo,
    project,
    generatedAt: new Date().toISOString(),
    runs: [],
    openAutopilotPulls: [],
    openIssues: [],
    errors: [],
  };

  try {
    const runsResponse = await githubGet<{ workflow_runs: WorkflowRun[] }>(
      `https://api.github.com/repos/${project.repo}/actions/runs?per_page=50`,
    );

    const matchingRuns = runsResponse.workflow_runs
      .filter((run) => isAutopilotRun(run, project.workflowNames))
      .filter((run) => new Date(run.created_at) >= since)
      .slice(0, options.limit);

    report.runs = await Promise.all(
      matchingRuns.map(async (run) => ({
        ...normalizeRun(run),
        durationSeconds: durationSeconds(run.run_started_at ?? run.created_at, run.updated_at),
        jobs: await collectJobs(run.jobs_url, report.errors),
      })),
    );
  } catch (error) {
    report.errors.push(errorMessage(error));
  }

  try {
    report.openAutopilotPulls = await collectOpenPulls(project.repo);
  } catch (error) {
    report.errors.push(errorMessage(error));
  }

  try {
    report.openIssues = await collectOpenIssues(project.repo);
  } catch (error) {
    report.errors.push(errorMessage(error));
  }

  return report;
}

function isAutopilotRun(run: WorkflowRun, workflowNames: string[]): boolean {
  return workflowNames.includes(run.name ?? "") || run.path.endsWith("/autopilot.yml") || run.path.endsWith("/autopilot.yaml");
}

function normalizeRun(run: WorkflowRun): WorkflowRun {
  return {
    id: run.id,
    name: run.name,
    path: run.path,
    display_title: run.display_title,
    run_number: run.run_number,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url,
    created_at: run.created_at,
    updated_at: run.updated_at,
    run_started_at: run.run_started_at,
    head_branch: run.head_branch,
    head_sha: run.head_sha,
    head_commit: {
      message: run.head_commit?.message,
      author: run.head_commit?.author,
    },
    actor: run.actor,
    jobs_url: run.jobs_url,
  };
}

async function collectJobs(jobsUrl: string, errors: string[]): Promise<Job[]> {
  try {
    const response = await githubGet<{ jobs: Job[] }>(jobsUrl);
    return response.jobs.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      html_url: job.html_url,
      started_at: job.started_at,
      completed_at: job.completed_at,
      steps: job.steps?.filter((step) => step.conclusion && step.conclusion !== "success"),
    }));
  } catch (error) {
    errors.push(errorMessage(error));
    return [];
  }
}

async function collectOpenPulls(repo: RepoSlug): Promise<PullRequest[]> {
  const response = await githubGet<PullRequest[]>(
    `https://api.github.com/repos/${repo}/pulls?state=open&per_page=50`,
  );

  return response
    .filter((pull) => {
      const haystack = `${pull.title} ${pull.user?.login ?? ""}`.toLowerCase();
      return CARETTA_IDENTIFIERS.some((identifier) => haystack.includes(identifier));
    })
    .map((pull) => ({
      title: pull.title,
      html_url: pull.html_url,
      number: pull.number,
      state: pull.state,
      user: pull.user,
      created_at: pull.created_at,
      updated_at: pull.updated_at,
      auto_merge: pull.auto_merge,
    }))
    .slice(0, 10);
}

async function collectOpenIssues(repo: RepoSlug): Promise<Issue[]> {
  const response = await githubGet<Issue[]>(
    `https://api.github.com/repos/${repo}/issues?state=open&per_page=50`,
  );

  return response
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      title: issue.title,
      html_url: issue.html_url,
      number: issue.number,
      state: issue.state,
      user: issue.user,
      labels: issue.labels?.map((label) => ({ name: label.name })).filter((label) => Boolean(label.name)),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }))
    .slice(0, 20);
}

function durationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const elapsed = Date.parse(end) - Date.parse(start);
  return Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed / 1000) : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildFieldMap(snapshot: Snapshot, previousStates: Map<RepoSlug, PreviousRepoState>): FieldMap {
  const projects = snapshot.repos.map((repo) => buildRepoField(repo, previousStates.get(repo.repo) ?? null));
  const actions = projects.flatMap((project) => project.actions).sort(compareActions);

  return {
    generatedAt: snapshot.generatedAt,
    metaphor: "geomagnetic-navigation-field",
    summary: {
      projects: projects.length,
      recentRuns: projects.reduce((sum, project) => sum + project.signals.recentRuns, 0),
      failedRuns: projects.reduce((sum, project) => sum + project.signals.failedRuns, 0),
      activeRuns: projects.reduce((sum, project) => sum + project.signals.activeRuns, 0),
      openAutopilotPulls: projects.reduce((sum, project) => sum + project.signals.openAutopilotPulls, 0),
      openIssues: projects.reduce((sum, project) => sum + project.signals.openIssues, 0),
      blockedProjects: projects.filter((project) => project.hazardLevel === "blocked").length,
      watchedProjects: projects.filter((project) => project.hazardLevel === "watch").length,
      clearProjects: projects.filter((project) => project.hazardLevel === "clear").length,
    },
    projects,
    actions,
  };
}

function buildRepoField(repo: RepoReport, previous: PreviousRepoState | null): RepoField {
  const failedRuns = repo.runs.filter((run) => run.conclusion && run.conclusion !== "success");
  const activeRuns = repo.runs.filter((run) => run.status !== "completed");
  const latestRun = repo.runs[0] ?? null;
  const latestRunSignal = latestRun
    ? {
      id: latestRun.id,
      runNumber: latestRun.run_number,
      conclusion: latestRun.conclusion,
      status: latestRun.status,
      branch: latestRun.head_branch,
      createdAt: latestRun.created_at,
      url: latestRun.html_url,
      durationSeconds: latestRun.durationSeconds,
    }
    : null;

  const hazards = buildHazards(repo, failedRuns, activeRuns);
  const hazardLevel = classifyHazards(repo, failedRuns, activeRuns);
  const field: RepoField = {
    repo: repo.repo,
    priority: repo.project.priority,
    risk: repo.project.risk,
    workflowNames: repo.project.workflowNames,
    owners: repo.project.owners,
    allowedActions: repo.project.allowedActions,
    factoryContext: repo.project.factoryContext,
    deploy: repo.project.deploy,
    signals: {
      latestRun: latestRunSignal,
      recentRuns: repo.runs.length,
      failedRuns: failedRuns.length,
      activeRuns: activeRuns.length,
      openAutopilotPulls: repo.openAutopilotPulls.length,
      openIssues: repo.openIssues.length,
      collectionErrors: repo.errors.length,
    },
    currentIssues: repo.openIssues,
    hazards,
    hazardLevel,
    drift: {
      previousGeneratedAt: previous?.generatedAt ?? null,
      latestRunChanged: previous ? previous.latestRunId !== (latestRun?.id ?? null) : null,
      openPullDelta: previous ? repo.openAutopilotPulls.length - previous.openPullCount : null,
      failureDelta: previous ? failedRuns.length - previous.failureCount : null,
      hazardChanged: previous ? previous.hazardLevel !== hazardLevel : null,
    },
    routes: buildRoutes(repo, failedRuns, activeRuns, hazardLevel),
    actions: [],
  };

  field.actions = buildActions(repo, failedRuns, activeRuns, hazardLevel);
  return field;
}

function buildHazards(repo: RepoReport, failedRuns: RepoReport["runs"], activeRuns: RepoReport["runs"]): string[] {
  const hazards: string[] = [];
  if (repo.errors.length > 0) hazards.push("collector-errors");
  if (repo.runs.length === 0) hazards.push("no-recent-autopilot-runs");
  if (failedRuns.length > 0) hazards.push("failed-autopilot-runs");
  if (activeRuns.length > 0) hazards.push("active-autopilot-runs");
  if (repo.openAutopilotPulls.length > 0) hazards.push("open-autopilot-prs");
  if (repo.openAutopilotPulls.length > 2) hazards.push("crowded-autopilot-pr-queue");
  if (repo.openIssues.length > 0) hazards.push("open-issues");
  return hazards;
}

function classifyHazards(repo: RepoReport, failedRuns: RepoReport["runs"], activeRuns: RepoReport["runs"]): HazardLevel {
  if (repo.errors.length > 0 || failedRuns.length > 0) return "blocked";
  if (repo.runs.length === 0 || activeRuns.length > 0 || repo.openAutopilotPulls.length > 0 || repo.openIssues.length > 0) return "watch";
  return "clear";
}

function buildRoutes(
  repo: RepoReport,
  failedRuns: RepoReport["runs"],
  activeRuns: RepoReport["runs"],
  hazardLevel: HazardLevel,
): string[] {
  const routes: string[] = [];

  if (repo.errors.length > 0) {
    routes.push("Restore collector access before using this repo for routing decisions.");
  }
  if (repo.runs.length === 0) {
    routes.push("Verify the Autopilot workflow exists and has run inside the lookback window.");
  }
  if (failedRuns.length > 0) {
    routes.push("Inspect failed jobs and retry only after the failing step is understood.");
  }
  if (activeRuns.length > 0) {
    routes.push("Let active runs settle before dispatching new work.");
  }
  if (repo.openAutopilotPulls.length > 0) {
    routes.push("Review open autopilot PRs; merge ready work or close stale routes.");
  }
  if (repo.openIssues.length > 0) {
    routes.push("Review current issues and route the highest-impact open items.");
  }
  if (repo.project.deploy) {
    const policy = repo.project.deploy.policy ?? "manual review";
    routes.push(`Apply deploy policy before release movement: ${policy}.`);
  }
  if (hazardLevel === "clear") {
    routes.push("Keep this repo on normal observation cadence.");
  }

  return routes;
}

function buildActions(
  repo: RepoReport,
  failedRuns: RepoReport["runs"],
  activeRuns: RepoReport["runs"],
  hazardLevel: HazardLevel,
): RepoAction[] {
  const actions: RepoAction[] = [];

  if (repo.errors.length > 0) {
    actions.push({
      repo: repo.repo,
      priority: "urgent",
      reason: "GitHub collection failed, so the field map is incomplete.",
      command: "Restore GitHub API access or repository permissions.",
      links: [],
    });
  }

  if (failedRuns.length > 0) {
    actions.push({
      repo: repo.repo,
      priority: "urgent",
      reason: `${failedRuns.length} recent autopilot run(s) failed or ended non-successfully.`,
      command: "Inspect failed jobs, patch the root cause, then rerun Autopilot.",
      links: failedRuns.map((run) => run.html_url),
    });
  }

  if (activeRuns.length > 0) {
    actions.push({
      repo: repo.repo,
      priority: "next",
      reason: `${activeRuns.length} autopilot run(s) are still active.`,
      command: "Wait for active runs to finish before creating new work.",
      links: activeRuns.map((run) => run.html_url),
    });
  }

  if (repo.runs.length === 0) {
    actions.push({
      repo: repo.repo,
      priority: "next",
      reason: "No recent Autopilot run was found in the lookback window.",
      command: "Check workflow naming, scheduling, and repository inclusion.",
      links: [],
    });
  }

  if (repo.openAutopilotPulls.length > 0) {
    actions.push({
      repo: repo.repo,
      priority: repo.openAutopilotPulls.length > 2 ? "urgent" : "next",
      reason: `${repo.openAutopilotPulls.length} autopilot PR(s) are open.`,
      command: "Review, merge, or close open autopilot PRs before adding more migration pressure.",
      links: repo.openAutopilotPulls.map((pull) => pull.html_url),
    });
  }

  if (repo.openIssues.length > 0) {
    actions.push({
      repo: repo.repo,
      priority: "next",
      reason: `${repo.openIssues.length} current issue(s) are open.`,
      command: "Review and prioritize current open issues.",
      links: repo.openIssues.map((issue) => issue.html_url),
    });
  }

  if (hazardLevel === "clear") {
    actions.push({
      repo: repo.repo,
      priority: "observe",
      reason: "Recent runs are successful and no open autopilot PRs were detected.",
      command: "Continue normal observation cadence.",
      links: repo.runs[0] ? [repo.runs[0].html_url] : [],
    });
  }

  return actions;
}

function compareActions(left: RepoAction, right: RepoAction): number {
  const order: Record<ActionPriority, number> = { urgent: 0, next: 1, observe: 2 };
  return order[left.priority] - order[right.priority] || left.repo.localeCompare(right.repo);
}

async function buildCodexReport(snapshot: Snapshot, fieldMap: FieldMap, options: Options): Promise<string | { finalResponse: string; usage?: { input_tokens: number; output_tokens: number } }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Codex report generation");
  }

  const codex = new Codex({ apiKey });
  const thread = codex.startThread({
    model: options.model,
    modelReasoningEffort: options.reasoning,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
    skipGitRepoCheck: true,
    workingDirectory: process.cwd(),
  });

  const result = await thread.run(`You are writing a Geodynamo operational field report for Caretta autopilot navigation.

Use only the JSON snapshot and field map below. Do not browse or infer facts outside them.
Write concise GitHub-flavored Markdown suitable for a CI job summary.
Lead with a brief fleet summary, then one section per repo.
Call out blocked routes, watch routes, stale/missing runs, open autopilot PRs, recurring failed jobs or steps, and concrete next actions.
Display current open issues for each repo when present.
Include run links where useful.

Snapshot:
${JSON.stringify(snapshot, null, 2)}

Field map:
${JSON.stringify(fieldMap, null, 2)}
`);

  if (result.usage) {
    console.log(`Codex report usage: ${result.usage.input_tokens} input + ${result.usage.output_tokens} output tokens (${result.usage.input_tokens + result.usage.output_tokens} total)`);
  }

  return result;
}

function buildFallbackReport(snapshot: Snapshot, fieldMap: FieldMap, codexError?: string): string {
  const lines = [
    "# Geodynamo Field Report",
    "",
    `Generated: ${snapshot.generatedAt}`,
    `Workflow: ${snapshot.workflowName}`,
    "",
  ];

  if (codexError) {
    lines.push("> Codex SDK report generation failed; this deterministic report was emitted instead.", "");
    lines.push("```text", codexError, "```", "");
  }

  lines.push(
    "## Fleet Summary",
    "",
    `- Projects: ${fieldMap.summary.projects}`,
    `- Recent autopilot runs: ${fieldMap.summary.recentRuns}`,
    `- Failed or non-success runs: ${fieldMap.summary.failedRuns}`,
    `- Active runs: ${fieldMap.summary.activeRuns}`,
    `- Open autopilot PRs: ${fieldMap.summary.openAutopilotPulls}`,
    `- Current open issues: ${fieldMap.summary.openIssues}`,
    `- Blocked/watch/clear: ${fieldMap.summary.blockedProjects}/${fieldMap.summary.watchedProjects}/${fieldMap.summary.clearProjects}`,
    "",
  );

  for (const repo of snapshot.repos) {
    const field = fieldMap.projects.find((project) => project.repo === repo.repo);
    lines.push(`## ${repo.repo}`, "");

    if (field) {
      lines.push(`Field: ${field.hazardLevel}`);
      if (field.hazards.length > 0) {
        lines.push(`Hazards: ${field.hazards.join(", ")}`);
      }
      if (field.drift.previousGeneratedAt) {
        lines.push(
          `Drift: open PRs ${formatDelta(field.drift.openPullDelta)}, failures ${formatDelta(field.drift.failureDelta)}, latest run changed ${formatNullableBoolean(field.drift.latestRunChanged)}`,
        );
      }
      lines.push("");
    }

    if (repo.errors.length > 0) {
      lines.push("Collector errors:");
      for (const error of repo.errors) lines.push(`- ${error}`);
      lines.push("");
    }

    if (repo.runs.length === 0) {
      lines.push("- No matching recent autopilot runs found.", "");
    } else {
      for (const run of repo.runs) {
        const conclusion = run.conclusion ?? run.status;
        const duration = run.durationSeconds === null ? "unknown duration" : formatDuration(run.durationSeconds);
        lines.push(`- [#${run.run_number}](${run.html_url}) ${conclusion} on ${run.head_branch ?? "unknown branch"} at ${run.created_at} (${duration})`);
        if (run.head_commit?.message) {
          lines.push(`  Commit: ${firstLine(run.head_commit.message)}`);
        }
        for (const job of run.jobs.filter((job) => job.conclusion && job.conclusion !== "success")) {
          lines.push(`  Failed job: [${job.name}](${job.html_url}) (${job.conclusion})`);
          for (const step of job.steps ?? []) {
            lines.push(`  Step: ${step.name} (${step.conclusion})`);
          }
        }
      }
      lines.push("");
    }

    if (repo.openAutopilotPulls.length > 0) {
      lines.push("Open autopilot PRs:");
      for (const pull of repo.openAutopilotPulls) {
        lines.push(`- [#${pull.number} ${pull.title}](${pull.html_url}) updated ${pull.updated_at}`);
      }
      lines.push("");
    }

    if (repo.openIssues.length > 0) {
      lines.push("Current issues:");
      for (const issue of repo.openIssues) {
        const labels = issue.labels && issue.labels.length > 0 ? ` (${issue.labels.map((label) => label.name).join(", ")})` : "";
        lines.push(`- [#${issue.number} ${issue.title}](${issue.html_url})${labels} updated ${issue.updated_at}`);
      }
      lines.push("");
    }

    if (field && field.routes.length > 0) {
      lines.push("Routes:");
      for (const route of field.routes) lines.push(`- ${route}`);
      lines.push("");
    }
  }

  if (fieldMap.actions.length > 0) {
    lines.push("## Action Plan", "");
    for (const action of fieldMap.actions) {
      lines.push(`- ${action.priority}: ${action.repo} - ${action.command}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function firstLine(value: string): string {
  return value.split("\n")[0] ?? value;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function formatDelta(value: number | null): string {
  if (value === null) return "n/a";
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatNullableBoolean(value: boolean | null): string {
  if (value === null) return "n/a";
  return value ? "yes" : "no";
}

type StateRow = {
  repo: string;
  generated_at: string;
  latest_run_id: number | null;
  latest_run_conclusion: string | null;
  latest_run_created_at: string | null;
  open_pull_count: number;
  failure_count: number;
  hazard_level: string;
};

type HistoryRow = {
  generated_at: string;
  snapshot_json: string;
};

type StateStore = {
  previous: Map<RepoSlug, PreviousRepoState>;
  save: (fieldMap: FieldMap) => void;
  history: () => HistoryOutput;
  close: () => void;
};

function openStateStore(path: string): StateStore {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_state (
      repo TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      latest_run_id INTEGER,
      latest_run_conclusion TEXT,
      latest_run_created_at TEXT,
      open_pull_count INTEGER NOT NULL,
      failure_count INTEGER NOT NULL,
      hazard_level TEXT NOT NULL,
      field_json TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_history (
      generated_at TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL
    )
  `);

  const rows = db.query("SELECT * FROM repo_state").all() as StateRow[];
  const previous = new Map<RepoSlug, PreviousRepoState>();
  for (const row of rows) {
    previous.set(parseRepo(row.repo), {
      repo: parseRepo(row.repo),
      generatedAt: row.generated_at,
      latestRunId: row.latest_run_id,
      latestRunConclusion: row.latest_run_conclusion,
      latestRunCreatedAt: row.latest_run_created_at,
      openPullCount: row.open_pull_count,
      failureCount: row.failure_count,
      hazardLevel: parseHazardLevel(row.hazard_level),
    });
  }

  const statement = db.prepare(`
    INSERT INTO repo_state (
      repo,
      generated_at,
      latest_run_id,
      latest_run_conclusion,
      latest_run_created_at,
      open_pull_count,
      failure_count,
      hazard_level,
      field_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repo) DO UPDATE SET
      generated_at = excluded.generated_at,
      latest_run_id = excluded.latest_run_id,
      latest_run_conclusion = excluded.latest_run_conclusion,
      latest_run_created_at = excluded.latest_run_created_at,
      open_pull_count = excluded.open_pull_count,
      failure_count = excluded.failure_count,
      hazard_level = excluded.hazard_level,
      field_json = excluded.field_json
  `);
  const historyStatement = db.prepare(`
    INSERT INTO field_history (
      generated_at,
      snapshot_json
    )
    VALUES (?, ?)
    ON CONFLICT(generated_at) DO UPDATE SET
      snapshot_json = excluded.snapshot_json
  `);
  const pruneStatement = db.prepare("DELETE FROM field_history WHERE generated_at < ?");
  const historyRows = db.query("SELECT * FROM field_history ORDER BY generated_at ASC");

  return {
    previous,
    save(fieldMap) {
      for (const project of fieldMap.projects) {
        statement.run(
          project.repo,
          fieldMap.generatedAt,
          project.signals.latestRun?.id ?? null,
          project.signals.latestRun?.conclusion ?? null,
          project.signals.latestRun?.createdAt ?? null,
          project.signals.openAutopilotPulls,
          project.signals.failedRuns,
          project.hazardLevel,
          JSON.stringify(project),
        );
      }
      historyStatement.run(fieldMap.generatedAt, JSON.stringify(compactHistorySnapshot(fieldMap)));
      pruneStatement.run(historyCutoff(fieldMap.generatedAt));
    },
    history() {
      const snapshots = (historyRows.all() as HistoryRow[]).map((row) => parseHistorySnapshot(row));
      return buildHistoryOutput(new Date().toISOString(), snapshots);
    },
    close() {
      db.close();
    },
  };
}

function parseHazardLevel(value: string): HazardLevel {
  if (value === "clear" || value === "watch" || value === "blocked") return value;
  return "watch";
}

function compactHistorySnapshot(fieldMap: FieldMap): HistorySnapshot {
  return {
    generatedAt: fieldMap.generatedAt,
    summary: fieldMap.summary,
    projects: fieldMap.projects.map((project) => ({
      repo: project.repo,
      hazardLevel: project.hazardLevel,
      failedRuns: project.signals.failedRuns,
      activeRuns: project.signals.activeRuns,
      openAutopilotPulls: project.signals.openAutopilotPulls,
      openIssues: project.signals.openIssues,
      latestRunId: project.signals.latestRun?.id ?? null,
      actionPriorities: compactActionPriorities(project.actions),
    })),
  };
}

function compactActionPriorities(actions: RepoAction[]): ActionPriority[] {
  const order: ActionPriority[] = ["urgent", "next", "observe"];
  return order.filter((priority) => actions.some((action) => action.priority === priority));
}

function buildHistoryOutput(generatedAt: string, snapshots: HistorySnapshot[]): HistoryOutput {
  return {
    generatedAt,
    retentionDays: HISTORY_RETENTION_DAYS,
    snapshots: snapshots.slice().sort((left, right) => left.generatedAt.localeCompare(right.generatedAt)),
  };
}

async function loadCoreContext(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`Core context document not found: ${path}`);
  }
  const text = (await file.text()).trim();
  if (!text) {
    throw new Error(`Core context document is empty: ${path}`);
  }
  return text;
}

async function buildCodexProjectContexts(fieldMap: FieldMap, options: Options): Promise<ProjectContextOutput[]> {
  if (!options.contextsOutput) return [];
  if (options.noCodex) {
    throw new Error("--contexts-output requires Codex SDK; remove --no-codex or omit context generation");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Codex project context generation");
  }

  const coreContext = await loadCoreContext(options.coreContextPath);
  const codex = new Codex({ apiKey });
  const thread = codex.startThread({
    model: options.model,
    modelReasoningEffort: options.reasoning,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
    skipGitRepoCheck: true,
    workingDirectory: process.cwd(),
  });

  const result = await thread.run(`You are generating Caretta factory-cycle context files for a geodynamo-managed project set.

Use the core behavior document as the governing policy. Use only the field map, shared context, and project facts provided below.
Return only a JSON object with this exact shape:
{
  "projects": [
    {
      "repo": "owner/name",
      "title": "short feature-set title",
      "context": "factory-cycle context for this project",
      "featureSets": ["feature set name"],
      "rationale": "why this context fits the current field",
      "guardrails": ["scope or safety guardrail"]
    }
  ]
}

Rules:
- Generate exactly one project entry for every fieldMap.projects item.
- The context is for Caretta factory cycles only.
- Drive cohesive sets of user-facing features by default.
- Treat CI, dependency, architecture, and cleanup work as support work unless it directly unlocks user-facing capability.
- Do not mention other managed repositories inside a project's context.
- Do not instruct a project to depend on another managed project.
- Keep each context concise, directive, and ready to pass as CARETTA_CONTEXT.

Core behavior document:
${coreContext}

Shared geodynamo context:
${JSON.stringify(options.factoryContext, null, 2)}

Field map:
${JSON.stringify(fieldMap, null, 2)}
`);

  if (result.usage) {
    console.log(`Codex contexts usage: ${result.usage.input_tokens} input + ${result.usage.output_tokens} output tokens (${result.usage.input_tokens + result.usage.output_tokens} total)`);
  }

  const generated = parseCodexContextResponse(result.finalResponse);
  const generatedByRepo = new Map(
    generated.projects.map((project) => [project.repo.toLowerCase(), project]),
  );

  return fieldMap.projects.map((project) => {
    const generatedProject = generatedByRepo.get(project.repo.toLowerCase());
    if (!generatedProject?.context?.trim()) {
      throw new Error(`Codex project context response omitted context for ${project.repo}`);
    }

    return {
      schema: "geodynamo.project-context.v1",
      generatedAt: fieldMap.generatedAt,
      scope: "caretta-factory-cycle-only",
      source: "geodynamo",
      repo: project.repo,
      projectName: projectNameFromRepo(project.repo),
      coreContextPath: options.coreContextPath,
      context: generatedProject.context.trim(),
      title: generatedProject.title?.trim() || "Factory-cycle feature set",
      featureSets: normalizeGeneratedList(generatedProject.featureSets),
      rationale: generatedProject.rationale?.trim() || "",
      guardrails: normalizeGeneratedList(generatedProject.guardrails),
      priority: project.priority,
      risk: project.risk,
      hazardLevel: project.hazardLevel,
      hazards: project.hazards,
      signals: project.signals,
      routes: project.routes,
      actions: project.actions,
    };
  });
}

function parseCodexContextResponse(response: string): CodexProjectContextsResponse {
  const parsed = JSON.parse(extractJsonObject(response)) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.projects)) {
    throw new Error("Codex project context response must contain a projects array");
  }

  return {
    projects: parsed.projects.map((project) => {
      if (!isRecord(project) || typeof project.repo !== "string" || typeof project.context !== "string") {
        throw new Error("Each Codex project context must include repo and context strings");
      }
      return project as CodexProjectContext;
    }),
  };
}

function extractJsonObject(response: string): string {
  const trimmed = response.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);

  throw new Error("Codex project context response did not contain a JSON object");
}

function normalizeGeneratedList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function projectNameFromRepo(repo: RepoSlug): string {
  const name = repo.split("/")[1] ?? repo;
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseHistorySnapshot(row: HistoryRow): HistorySnapshot {
  const parsed = JSON.parse(row.snapshot_json) as Partial<HistorySnapshot>;
  return {
    generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : row.generated_at,
    summary: parsed.summary as FieldMap["summary"],
    projects: Array.isArray(parsed.projects) ? parsed.projects as HistoryProject[] : [],
  };
}

function historyCutoff(generatedAt: string): string {
  const parsed = Date.parse(generatedAt);
  const baseTime = Number.isFinite(parsed) ? parsed : Date.now();
  return new Date(baseTime - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function writeOutputs(
  report: string,
  snapshot: Snapshot,
  fieldMap: FieldMap,
  history: HistoryOutput,
  projectContexts: ProjectContextOutput[],
  options: Options,
  totalInputTokens: number,
  totalOutputTokens: number,
) {
  if (options.output) {
    await Bun.write(options.output, report);
  }

  if (options.jsonOutput) {
    await Bun.write(options.jsonOutput, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  if (options.fieldOutput) {
    await Bun.write(options.fieldOutput, `${JSON.stringify(fieldMap, null, 2)}\n`);
  }

  if (options.planOutput) {
    await Bun.write(options.planOutput, `${JSON.stringify({
      generatedAt: fieldMap.generatedAt,
      actions: fieldMap.actions,
    }, null, 2)}\n`);
  }

  if (options.historyOutput) {
    await Bun.write(options.historyOutput, `${JSON.stringify(history, null, 2)}\n`);
  }

  if (options.contextsOutput) {
    await writeProjectContexts(options.contextsOutput, projectContexts);
  }

  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    const usageLine = !options.noCodex
      ? `\n\n**Total Codex token usage:** ${totalInputTokens} input + ${totalOutputTokens} output = ${totalInputTokens + totalOutputTokens} tokens`
      : "";
    await Bun.write(stepSummary, report + usageLine);
  }
}

async function writeProjectContexts(baseDir: string, contexts: ProjectContextOutput[]) {
  for (const context of contexts) {
    const dir = `${baseDir}/${context.projectName}`;
    await mkdir(dir, { recursive: true });
    await Bun.write(`${dir}/context.json`, `${JSON.stringify(context, null, 2)}\n`);
  }
}

async function main() {
  const options = await parseArgs(process.argv.slice(2));
  const state = options.noState || !options.statePath ? null : openStateStore(options.statePath);
  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    workflowName: options.workflowName,
    repos: await Promise.all(options.projects.map((project) => collectRepo(project, options))),
  };
  const fieldMap = buildFieldMap(snapshot, state?.previous ?? new Map());
  const projectContexts = await buildCodexProjectContexts(fieldMap, options);

  let report: string;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  if (options.noCodex) {
    report = buildFallbackReport(snapshot, fieldMap);
  } else {
    try {
      const reportResult = await buildCodexReport(snapshot, fieldMap, options);
      if (typeof reportResult === "string") {
        report = reportResult.trim();
      } else {
        report = reportResult.finalResponse.trim();
        if (reportResult.usage) {
          totalInputTokens += reportResult.usage.input_tokens;
          totalOutputTokens += reportResult.usage.output_tokens;
        }
      }
    } catch (error) {
      if (options.failOnCodexError) throw error;
      report = buildFallbackReport(snapshot, fieldMap, errorMessage(error));
    }
  }

  state?.save(fieldMap);
  const history = state
    ? state.history()
    : buildHistoryOutput(snapshot.generatedAt, [compactHistorySnapshot(fieldMap)]);
  state?.close();

  await writeOutputs(report, snapshot, fieldMap, history, projectContexts, options, totalInputTokens, totalOutputTokens);
  console.log(report);

  if (!options.noCodex) {
    const totalUsage = `Total Codex token usage: ${totalInputTokens} input + ${totalOutputTokens} output = ${totalInputTokens + totalOutputTokens} tokens`;
    console.log(`\n${totalUsage}`);
  }
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exit(1);
});
