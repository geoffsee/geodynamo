# Geodynamo Roadmap (v1)

Status: roadmap / planning draft  
Date: 2026-06-23

This roadmap turns the current Geodynamo, Helios, and Caretta idea documents into an implementation sequence. It assumes the architecture proposed in:

- [Caretta Over Geodynamo Working Hypothesis (v2)](./06-caretta-driven-geodynamo-working-hypothesis-v2.md)
- [Helios Parent System Proposal (v2)](./07-helios-parent-system-proposal-v2.md)

The roadmap is intentionally conservative. Geodynamo should continue to be a read-only field publisher. The dashboard should remain publish-only. Helios should start as a declarative source-of-intent layer that can generate existing Geodynamo configuration. Caretta should remain downstream behind an explicit external adapter and policy gate.

## Roadmap Claim

The next useful version of the system is not an autonomous control plane. It is a clearer field-publication stack with testable contracts at each boundary:

```text
Helios manifest
  -> generated geodynamo-projects.json
  -> Geodynamo read-only collection and field publication
  -> dashboard + published artifacts
  -> optional external Caretta adapter
  -> optional Caretta CLI / GitHub Action invocation
```

The first roadmap goal is to make each handoff reproducible, inspectable, and safe before adding more automation.

## Guiding Principles

- Preserve one-way dependency direction: upstream intent, read-only field publication, downstream workflow navigation.
- Prefer generated files, schemas, and artifacts over runtime coupling.
- Keep Geodynamo and the dashboard Caretta-neutral.
- Treat `allowedActions` as a policy ceiling, not an instruction to mutate state.
- Require source links and raw artifact audit paths for any compressed route or recommendation.
- Optimize first for clearer human review and safer routing, not autonomous mutation.
- Make every phase reversible until the contracts are proven.

## Phase 0: Baseline and Contracts

Purpose: document the current operating shape and define the contracts that later phases must preserve.

### Milestones

1. Capture the current Geodynamo artifact contract.
   - Inputs: `geodynamo-projects.json`, GitHub Actions state, local SQLite history.
   - Outputs: operator report, snapshot JSON, field map JSON, action plan JSON, history JSON, dashboard assets.
2. Define minimal schemas for the published artifacts that downstream consumers rely on.
3. Record the dashboard non-goals: no dispatch, mutation, approval, retry, labeling, merging, or workflow invocation.
4. Add fixture snapshots or golden examples for the current configured repositories.
5. Establish a lightweight contract check for generated JSON shape and required source links.

### Acceptance Criteria

- Geodynamo can run from the existing config and publish the same artifact set.
- Published artifacts have documented required fields.
- Dashboard behavior remains read-only.
- Contract checks fail when required route, action, or source-link fields disappear.

## Phase 1: Helios Manifest Experiment

Purpose: prove that Helios can clarify intent and reduce config drift without becoming a runtime dependency.

### Milestones

1. Create a `helios.fleet.v1` manifest covering the repositories currently listed in `geodynamo-projects.json`.
2. Validate required fields: `fleet`, `retentionDays`, `defaults.workflowNames`, `defaults.allowedActions`, and `projects[].repo`.
3. Implement policy resolution with a conservative `stricter wins` rule.
4. Generate an effective `geodynamo-projects.json` shape from the Helios manifest.
5. Compare generated config against the hand-maintained config for drift.
6. Run the existing Geodynamo workflow from the generated config without adding a Helios runtime service.

### Acceptance Criteria

- The same Helios manifest produces reproducible generated config.
- Policy conflicts are surfaced before Geodynamo runs.
- Geodynamo does not import Helios runtime code or Caretta-specific schemas.
- The dashboard and artifacts remain neutral publication surfaces.

## Phase 2: Artifact and Field Hardening

Purpose: make the Geodynamo field outputs stable enough for humans, dashboards, and downstream adapters.

### Milestones

1. Stabilize field vocabulary for hazards, drift, route pressure, action priority, and source links.
2. Distinguish declared, inherited, and derived policy values in generated or published context where practical.
3. Ensure collector errors and stale timestamps are represented as hazards, not as missing health signals.
4. Add history checks that separate one-off failures from repeated failures.
5. Improve dashboard display of fleet state, 30-day trend, and artifact freshness without adding controls.

### Acceptance Criteria

- Field map and action plan explain why each route is `urgent`, `next`, or `observe`.
- Missing or stale data creates visible uncertainty.
- Repeated failures are identifiable from history.
- Dashboard review is faster without adding write affordances.

## Phase 3: Caretta Route Adapter Prototype

Purpose: test whether a downstream adapter can compress Geodynamo artifacts into `Z_caretta` without coupling Caretta to Geodynamo.

### Milestones

1. Implement an external adapter prototype that reads published Geodynamo artifacts.
2. Emit `caretta.geodynamo.route.v1` route objects with required fields, enums, policy summary, confidence, reason, and source links.
3. Apply conservative routing precedence for collector errors, deployment-sensitive projects, repeated failures, PR queue pressure, and low-confidence states.
4. Default uncertain routes to `dry-run` or `observe`.
5. Keep all Caretta invocation optional and outside Geodynamo.

### Acceptance Criteria

- `Z_caretta` can be generated from published artifacts only.
- Every route has inspectable source links.
- No route recommends mutation when `allowedActions` is only `observe` and `report`.
- Geodynamo remains unaware of Caretta workflow internals.

## Phase 4: Evaluation Loop

Purpose: determine whether the contracts improve review quality before expanding automation.

### Milestones

1. Compare decisions made from raw snapshots against decisions made from field map, action plan, history, and `Z_caretta`.
2. Measure reviewer time-to-decision, false urgent rate, false clear rate, workflow misroutes, and source-link sufficiency.
3. Track config drift between Helios manifest and generated Geodynamo config.
4. Track dashboard scan time and artifact freshness issues.
5. Record unsafe automation recommendations as release-blocking failures.

### Acceptance Criteria

- `Z_caretta` decisions have equal or better agreement with raw-state expert decisions.
- Reviewer time-to-decision decreases or stays flat with better auditability.
- Unsafe automation recommendations remain zero.
- Manual config drift decreases.
- No runtime coupling is introduced between Geodynamo and Caretta.

## Phase 5: Controlled Programmatic Invocation

Purpose: only after evaluation succeeds, allow downstream programmatic invocation in review-gated or dry-run modes.

### Milestones

1. Define adapter-local policy for when `dry-run`, `review-gated`, or `auto` modes are even eligible.
2. Start with `dry-run` Caretta CLI or GitHub Action invocation from saved artifacts.
3. Require explicit review for deployment-sensitive repositories and crowded PR queues.
4. Add cooldowns and queue-pressure checks to avoid feedback amplification.
5. Consider `auto` only for narrow, reversible actions with explicit policy beyond `observe` and `report`.

### Acceptance Criteria

- Programmatic invocation is never triggered by the dashboard.
- `dry-run` and `review-gated` modes are auditable from route object to source artifacts.
- `auto` remains disabled unless project policy and adapter policy both explicitly permit it.
- Failed or low-confidence routes degrade to observe-only behavior.

## Cross-Cutting Work

| Workstream | Near-term outcome |
| --- | --- |
| Schema contracts | Minimal JSON contracts for Helios manifest, generated Geodynamo config, field artifacts, and `Z_caretta`. |
| Test fixtures | Representative snapshots for clear, watch, blocked, stale, and collector-error states. |
| Documentation | Shared terminology for intent, policy, state, field, route, hazard, drift, and pressure. |
| Security and secrets | No secrets in published artifacts, generated configs, route objects, or dashboard assets. |
| Observability | Generated timestamps, artifact freshness checks, source links, and policy-resolution traces. |
| Governance | Explicit owners, escalation paths, review expectations, and deployment sensitivity. |

## Release Gates

| Gate | Required evidence |
| --- | --- |
| `roadmap-contracts-ready` | Artifact contracts documented and checked against fixtures. |
| `helios-experiment-ready` | Helios manifest generates reproducible Geodynamo config with visible policy resolution. |
| `field-hardening-ready` | Field map/action plan distinguish hazards, drift, repeated failures, and missing data. |
| `adapter-prototype-ready` | `Z_caretta` route objects generated from artifacts only, with source links and safe defaults. |
| `evaluation-ready` | Review metrics collected for raw-state and route-contract decisions. |
| `programmatic-invocation-ready` | Downstream invocation policy is review-gated, auditable, and dashboard-independent. |

## Non-Goals

- Do not turn Geodynamo into a Caretta launcher.
- Do not turn the dashboard into an operations console.
- Do not introduce a Helios runtime dependency before the generated-config experiment is proven.
- Do not hide raw snapshots, field maps, or action plans behind summary-only outputs.
- Do not allow `auto` mutation from `observe` / `report` policy alone.
- Do not optimize for autonomous action before the evaluation loop shows safe routing.

## Open Questions

- Should the Helios manifest live in this repository first, or in a separate parent repository?
- Should generated `geodynamo-projects.json` be checked in, generated in CI, or both?
- How formal should the first JSON schemas be: documentation tables, TypeScript types, JSON Schema, or all three?
- Which fixture set best represents the current fleet: recent real snapshots, synthetic fixtures, or both?
- Which Caretta workflows should be eligible for dry-run evaluation first?
- What is the minimum evidence required before any review-gated invocation is allowed?

## Working Prediction

The roadmap is succeeding if the system becomes more boring and more inspectable: Helios reduces configuration drift, Geodynamo publishes clearer neutral artifacts, the dashboard remains read-only, and a downstream Caretta adapter can produce safe route contracts without changing Geodynamo's dependency boundary.

The earliest valuable result is not autonomy. It is a repeatable path from declared fleet intent to published operational field to auditable downstream route recommendations, with zero hidden control-plane behavior.