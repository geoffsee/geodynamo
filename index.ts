import { Codex, type ModelReasoningEffort } from "@openai/codex-sdk";

type RepoSlug = `${string}/${string}`;

type Options = {
  repos: RepoSlug[];
  configPath: string;
  workflowName: string;
  limit: number;
  days: number;
  model?: string;
  reasoning: ModelReasoningEffort;
  output?: string;
  jsonOutput?: string;
  noCodex: boolean;
  failOnCodexError: boolean;
};

type ConfigFile = {
  repos?: string[];
  workflowName?: string;
  limit?: number;
  days?: number;
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

type RepoReport = {
  repo: RepoSlug;
  generatedAt: string;
  runs: Array<WorkflowRun & { durationSeconds: number | null; jobs: Job[] }>;
  openAutopilotPulls: PullRequest[];
  errors: string[];
};

type Snapshot = {
  generatedAt: string;
  workflowName: string;
  repos: RepoReport[];
};

const DEFAULT_REPOS: RepoSlug[] = [
  "geoffsee/cortex-enigma",
  "geoffsee/midi-vibe",
  "geoffsee/bevy-osc-app",
];

const CARETTA_IDENTIFIERS = [
  "caretta-autopilot",
  "github-actions[bot]",
  "claude",
  "autopilot",
];

const DEFAULT_CONFIG_PATH = "caretta-projects.json";

async function parseArgs(argv: string[]): Promise<Options> {
  const preflight = parseConfigPath(argv);
  const config = await loadConfig(preflight.configPath);
  const options: Options = {
    repos: parseConfigRepos(config, preflight.configPath),
    configPath: preflight.configPath,
    workflowName: config.workflowName ?? "Autopilot",
    limit: config.limit ?? 5,
    days: config.days ?? 7,
    reasoning: "medium",
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
        options.repos.push(parseRepo(next()));
        break;
      case "--repos":
        options.repos = next().split(",").map((repo) => parseRepo(repo.trim()));
        break;
      case "--workflow":
        options.workflowName = next();
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

  options.repos = [...new Set(options.repos)];
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
    return { configPath: process.env.CARETTA_REPORT_CONFIG ?? DEFAULT_CONFIG_PATH };
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
      return { repos: DEFAULT_REPOS };
    }
    throw new Error(`Config file not found: ${path}`);
  }

  const parsed = await file.json() as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Config file must contain a JSON object: ${path}`);
  }

  return parsed as ConfigFile;
}

function parseConfigRepos(config: ConfigFile, configPath: string): RepoSlug[] {
  if (!config.repos || config.repos.length === 0) {
    throw new Error(`Config file must include at least one repo in "repos": ${configPath}`);
  }
  return config.repos.map((repo) => parseRepo(repo));
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
  console.log(`Caretta autopilot reporter

Usage:
  bun run report [options]

Options:
  --config path                   Project config, default: caretta-projects.json
  --repos owner/name,owner/name   Replace configured repos for this run
  --repo owner/name               Add a repo to configured repos for this run
  --workflow name                 Workflow name to filter, default: Autopilot
  --limit n                       Recent workflow runs per repo, default: 5
  --days n                        Lookback window in days, default: 7
  --model model                   Codex model override
  --reasoning level               minimal, low, medium, high, xhigh
  --output path                   Write markdown report to a file
  --json-output path              Write collected GitHub snapshot to a file
  --no-codex                      Skip Codex SDK and emit deterministic report
  --fail-on-codex-error           Exit non-zero if Codex report generation fails
`);
}

async function githubGet<T>(url: string): Promise<T> {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "caretta-codex-reporter",
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

async function collectRepo(repo: RepoSlug, options: Options): Promise<RepoReport> {
  const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
  const report: RepoReport = {
    repo,
    generatedAt: new Date().toISOString(),
    runs: [],
    openAutopilotPulls: [],
    errors: [],
  };

  try {
    const runsResponse = await githubGet<{ workflow_runs: WorkflowRun[] }>(
      `https://api.github.com/repos/${repo}/actions/runs?per_page=50`,
    );

    const matchingRuns = runsResponse.workflow_runs
      .filter((run) => isAutopilotRun(run, options.workflowName))
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
    report.openAutopilotPulls = await collectOpenPulls(repo);
  } catch (error) {
    report.errors.push(errorMessage(error));
  }

  return report;
}

function isAutopilotRun(run: WorkflowRun, workflowName: string): boolean {
  return run.name === workflowName || run.path.endsWith("/autopilot.yml") || run.path.endsWith("/autopilot.yaml");
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

function durationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const elapsed = Date.parse(end) - Date.parse(start);
  return Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed / 1000) : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function buildCodexReport(snapshot: Snapshot, options: Options): Promise<string> {
  const codex = new Codex();
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

  const result = await thread.run(`You are writing an operational status report for Caretta autopilot runs.

Use only the JSON snapshot below. Do not browse or infer facts outside it.
Write concise GitHub-flavored Markdown suitable for a CI job summary.
Lead with a brief fleet summary, then one section per repo.
Call out failures, stale/missing runs, open autopilot PRs, recurring failed jobs or steps, and concrete next actions.
Include run links where useful.

Snapshot:
${JSON.stringify(snapshot, null, 2)}
`);

  return result.finalResponse.trim();
}

function buildFallbackReport(snapshot: Snapshot, codexError?: string): string {
  const lines = [
    "# Caretta Autopilot Report",
    "",
    `Generated: ${snapshot.generatedAt}`,
    `Workflow: ${snapshot.workflowName}`,
    "",
  ];

  if (codexError) {
    lines.push("> Codex SDK report generation failed; this deterministic report was emitted instead.", "");
    lines.push("```text", codexError, "```", "");
  }

  const allRuns = snapshot.repos.flatMap((repo) => repo.runs);
  const failedRuns = allRuns.filter((run) => run.conclusion && run.conclusion !== "success");
  const activeRuns = allRuns.filter((run) => run.status !== "completed");
  const openPulls = snapshot.repos.reduce((count, repo) => count + repo.openAutopilotPulls.length, 0);

  lines.push(
    "## Fleet Summary",
    "",
    `- Repositories: ${snapshot.repos.length}`,
    `- Recent autopilot runs: ${allRuns.length}`,
    `- Failed or non-success runs: ${failedRuns.length}`,
    `- Active runs: ${activeRuns.length}`,
    `- Open autopilot PRs: ${openPulls}`,
    "",
  );

  for (const repo of snapshot.repos) {
    lines.push(`## ${repo.repo}`, "");

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

async function writeOutputs(report: string, snapshot: Snapshot, options: Options) {
  if (options.output) {
    await Bun.write(options.output, report);
  }

  if (options.jsonOutput) {
    await Bun.write(options.jsonOutput, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    await Bun.write(stepSummary, report);
  }
}

async function main() {
  const options = await parseArgs(process.argv.slice(2));
  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    workflowName: options.workflowName,
    repos: await Promise.all(options.repos.map((repo) => collectRepo(repo, options))),
  };

  let report: string;
  if (options.noCodex) {
    report = buildFallbackReport(snapshot);
  } else {
    try {
      report = await buildCodexReport(snapshot, options);
    } catch (error) {
      if (options.failOnCodexError) throw error;
      report = buildFallbackReport(snapshot, errorMessage(error));
    }
  }

  await writeOutputs(report, snapshot, options);
  console.log(report);
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exit(1);
});
