# geodynamo

Geodynamo is the Caretta navigation substrate. It watches the operational
signals around Caretta autopilots, stores enough history to notice drift, and
emits both a human report and agent-readable routing data.

Caretta projects are configured in `geodynamo-projects.json`:

```json
{
  "workflowName": "Autopilot",
  "limit": 5,
  "days": 7,
  "statePath": "geodynamo-state.sqlite",
  "projects": [
    {
      "repo": "geoffsee/midi-vibe",
      "priority": "high",
      "risk": "medium",
      "workflowNames": ["Autopilot"],
      "owners": [],
      "allowedActions": ["observe", "report"],
      "deploy": {
        "environment": "release",
        "policy": "review open autopilot PRs before release tagging",
        "url": "https://github.com/geoffsee/midi-vibe/actions/workflows/release.yml"
      }
    }
  ]
}
```

The older `repos` array shape still works for simple configurations, but
`projects` is the preferred format because it carries priority, risk, workflow,
owner, action, and deployment context.

## What It Emits

- Operator Markdown: a concise field report for a person reading CI output.
- Raw snapshot JSON: recent GitHub Actions runs, failed jobs/steps, and open
  autopilot PRs.
- Field map JSON: per-project signals, hazards, drift, routes, and actions for
  agents.
- Action plan JSON: the top-level action list extracted from the field map.
- History JSON: compact 30-day field snapshots for the published dashboard.
- SQLite state: previous run state used to detect drift across executions and
  compact field history for dashboard trends.
- Dashboard: a read-only React view built into `dist/dashboard`.

## Setup

```bash
bun install
```

For local Codex reporting, authenticate Codex/OpenAI the same way you use Codex
locally, or provide `OPENAI_API_KEY` if your environment uses API-key auth. For
higher GitHub API limits, set `GITHUB_TOKEN` or `GH_TOKEN`.

## Run Locally

```bash
bun run report
```

Useful options:

```bash
bun run report -- --limit 10 --days 14
bun run report -- --output geodynamo-report.md
bun run report -- --json-output geodynamo-snapshot.json
bun run report -- --field-output geodynamo-field-map.json --plan-output geodynamo-action-plan.json
bun run report -- --history-output geodynamo-history.json
bun run report -- --state geodynamo-state.sqlite
bun run report -- --no-state
bun run report -- --no-codex
bun run report -- --repo geoffsee/new-project
bun run report -- --repos geoffsee/cortex-enigma,geoffsee/midi-vibe
bun run report -- --config ./other-projects.json
```

`--no-codex` skips the Codex SDK and emits a deterministic report from the
collected GitHub snapshot and field map. This is useful for testing GitHub
access without spending model time.

## Run In CI

The included workflow at `.github/workflows/geodynamo-report.yml` runs on a
schedule and by manual dispatch. It writes the report to the GitHub Actions job
summary, restores the latest `geodynamo-state` artifact when one exists,
uploads the updated SQLite state, builds the dashboard, and publishes
`dist/dashboard` through GitHub Pages. It also uploads the Markdown report, raw
snapshot, field map, action plan, and history JSON as artifacts.

Configure a repository secret named `OPENAI_API_KEY` if CI should generate the
Codex-written report. Without it, the command will fall back to the
deterministic report unless `--fail-on-codex-error` is passed.

GitHub Pages must be enabled once in repository settings with Source set to
GitHub Actions before the first dashboard deployment can publish.

## Dashboard

```bash
bun run report -- --no-codex --no-state --limit 1 \
  --field-output geodynamo-field-map.json \
  --plan-output geodynamo-action-plan.json \
  --history-output geodynamo-history.json
bun run build:dashboard
```

For a local preview, copy the generated JSON files into `dist/dashboard` and
serve that directory with any static file server.

## Verify

```bash
bun run check
bun run report -- --no-codex --no-state --limit 1 --history-output /tmp/geodynamo-history.json
bun run build:dashboard
```
