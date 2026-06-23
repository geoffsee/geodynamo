# magnetosphere

Codex SDK driven reporter for Caretta autopilots. Projects are configured in
`caretta-projects.json`:

```json
{
  "workflowName": "Autopilot",
  "limit": 5,
  "days": 7,
  "repos": [
    "geoffsee/cortex-enigma",
    "geoffsee/midi-vibe",
    "geoffsee/bevy-osc-app"
  ]
}
```

To add a project, add another `owner/repo` string to `repos`.

The reporter collects recent GitHub Actions runs for the `Autopilot` workflow,
open autopilot PRs, and failed job/step details. It then asks the Codex SDK to
turn that snapshot into a concise operator report.

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
bun run report -- --output autopilot-report.md --json-output autopilot-snapshot.json
bun run report -- --no-codex
bun run report -- --repo geoffsee/new-project
bun run report -- --repos geoffsee/cortex-enigma,geoffsee/midi-vibe
bun run report -- --config ./other-projects.json
```

`--no-codex` skips the Codex SDK and emits a deterministic report from the
collected GitHub snapshot. This is useful for testing GitHub access without
spending model time.

## Run In CI

The included workflow at `.github/workflows/autopilot-report.yml` runs on a
schedule and by manual dispatch. It writes the report to the GitHub Actions job
summary and uploads both the Markdown report and raw JSON snapshot as artifacts.

Configure a repository secret named `OPENAI_API_KEY` if CI should generate the
Codex-written report. Without it, the command will fall back to the
deterministic report unless `--fail-on-codex-error` is passed.

## Verify

```bash
bun run check
bun run report -- --no-codex --limit 1
```
