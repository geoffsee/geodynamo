# Helios Parent System Proposal (v2)

Status: proposal / first-experiment candidate  
Date: 2026-06-23

This v2 revises [Helios Parent System Proposal](./05-helios-parent-system-proposal.md) by clarifying Helios as a declarative source-of-intent layer, defining policy resolution semantics, and recommending a first integration path that does not add runtime coupling to Geodynamo.

Helios is the parent system above Geodynamo. The name means "sun", which makes it a useful shorthand for the upstream source of operational illumination: fleet scope, observation cadence, publication intent, ownership, retention, and policy limits. Helios should not replace Geodynamo or Caretta.

## Core Claim

Helios owns intent and operating envelope. Geodynamo owns field sensing and artifact publication. Caretta remains a downstream programmatic consumer through an external adapter.

```text
Helios manifest -> generated geodynamo-projects.json -> Geodynamo -> published artifacts -> dashboard
Helios manifest -> generated geodynamo-projects.json -> Geodynamo -> published artifacts -> external Caretta adapter -> Caretta
```

The first integration should be generation, not runtime dependency. Helios should initially generate `geodynamo-projects.json` or a compatible checked-in/build artifact consumed by the existing Geodynamo run path.

## Responsibility Split

| Layer | Role | Owns | Must not own |
| --- | --- | --- | --- |
| Helios | Parent intent and operating envelope | fleet inventory, defaults, schedules, policy ceilings, retention, owners, dependency metadata | per-run GitHub telemetry, dashboard controls, Caretta workflow execution |
| Geodynamo | Read-only field publisher | collection, normalization, hazard classification, drift, history artifacts, dashboard publication | mutation, Caretta workflow internals, operator approvals |
| Caretta adapter | Programmatic route mapper | mapping generic field artifacts into Caretta route contracts under policy | Geodynamo collection, dashboard behavior, Helios source-of-truth rules |
| Caretta | Workflow execution system | CLI or GitHub Action invocation under explicit policy | Geodynamo internals, dashboard publication, Helios manifest generation |

The dependency direction should stay one-way. Helios may configure Geodynamo. Geodynamo should not know whether Caretta exists. Caretta should consume published artifacts through an adapter, not through an internal Geodynamo API.

## Terminology

| Term | Meaning |
| --- | --- |
| `intent` | What should be observed, published, retained, and emphasized. |
| `policy` | Limits on publication and downstream action. Policy is a constraint, not a command. |
| `scope` | The repositories, workflows, and project metadata in the fleet. |
| `orbit` | Observation cadence and project grouping: when and how often each project is seen. |
| `illumination` | The context Helios gives Geodynamo so field state is easier to interpret. |
| `field` | Geodynamo's derived operational representation. |
| `route` | Downstream workflow interpretation produced outside Geodynamo. |

## What Helios Adds

Helios gives Geodynamo a parent context without making Geodynamo more coupled. Good Helios responsibilities include:

- fleet inventory: which repositories or projects are in scope;
- observation cadence: which schedules run and at what frequency;
- retention policy: how long artifacts and state are meaningful;
- publication policy: which reports, dashboards, and JSON artifacts are produced;
- risk posture: default priority, risk, and review expectations by project;
- illumination windows: time ranges where automation should watch more closely;
- governance metadata: owners, escalation paths, and project grouping;
- dependency graph: which projects affect other projects downstream;
- policy ceilings: the maximum allowed downstream actions for each project.

## Candidate Manifest

Helios should publish a Caretta-neutral manifest. The exact format can evolve, but it should map cleanly to today's `geodynamo-projects.json`.

```json
{
  "schemaVersion": "helios.fleet.v1",
  "generatedAt": "2026-06-23T15:30:00.000-05:00",
  "fleet": "geoffsee",
  "retentionDays": 30,
  "statePath": "geodynamo-state.sqlite",
  "publication": {
    "dashboard": true,
    "artifacts": ["report", "snapshot", "field-map", "action-plan", "history"]
  },
  "defaults": {
    "workflowNames": ["Autopilot"],
    "allowedActions": ["observe", "report"],
    "reviewMode": "required",
    "priority": "normal",
    "risk": "medium"
  },
  "projects": [
    {
      "repo": "geoffsee/midi-vibe",
      "priority": "high",
      "risk": "medium",
      "owners": [],
      "workflowNames": ["Autopilot"],
      "allowedActions": ["observe", "report"],
      "deploy": {
        "environment": "release",
        "policy": "review open autopilot PRs before release tagging",
        "url": "https://github.com/geoffsee/midi-vibe/actions/workflows/release.yml"
      }
    }
  ],
  "dependencies": [
    {
      "from": "geoffsee/cortex-enigma",
      "to": "geoffsee/midi-vibe",
      "kind": "runtime"
    }
  ]
}
```

## Generated Geodynamo Config

The first experiment should compile the Helios manifest into the existing Geodynamo configuration shape.

```text
helios manifest
  -> validate schema and policy resolution
  -> generate geodynamo-projects.json
  -> run existing Geodynamo workflow
  -> publish neutral artifacts
```

This path is preferred because it:

- preserves the current Geodynamo execution model;
- avoids a new Helios runtime service;
- keeps Helios declarative;
- makes migration reversible;
- allows generated output to be reviewed in diffs;
- gives Caretta adapters the same artifact boundary as before.

## Policy Resolution

Helios should make policy precedence explicit. The safest default is "stricter wins".

| Conflict | Resolution |
| --- | --- |
| Fleet default allows more actions than project override | Project override wins. |
| Project override allows more actions than fleet ceiling | Fleet ceiling wins. |
| Dependency metadata marks project high-impact but project priority is normal | Elevate effective priority or require explicit waiver. |
| Fleet retention is longer than project retention | Use the stricter retention if compliance or privacy is the reason; otherwise use fleet default. |
| Fleet review mode is required but project says optional | Required wins. |
| Project risk is missing | Use default risk and mark derived value in generated output. |

Generated config should distinguish declared values from inherited values where possible. If that is too much for the first experiment, the generated file should at least be reproducible and traceable to the Helios manifest.

## `allowedActions` Semantics

`allowedActions` is a maximum permission boundary, not an instruction to act.

Recommended interpretation:

1. Helios declares the maximum allowed policy for each project.
2. Geodynamo publishes the effective policy as neutral context.
3. Geodynamo does not execute actions.
4. A downstream adapter may choose only actions allowed by Helios/Geodynamo context and by its own stricter local policy.
5. `auto` or mutation requires an explicit action permission beyond `observe` and `report`.

For the current configuration shape, `["observe", "report"]` means downstream systems may observe and report, but should not infer permission to label, merge, retry, push commits, or run `--auto` workflows.

## Information Model

```text
S_helios = {fleet scope, schedules, policy, ownership, risk, dependency graph}
S_ops = project_state(S_helios, GitHub_state)
B_ops = geodynamo_field(S_ops)
A_ops = publish(B_ops)
Z_caretta = phi_caretta(A_ops, adapter_policy)
```

| Symbol | Operational meaning |
| --- | --- |
| `S_helios` | Parent source of intent and observation scope. |
| `S_ops` | Concrete operational state derived from Helios scope plus live project state. |
| `B_ops` | Geodynamo field: hazards, drift, routes, actions, and links. |
| `A_ops` | Published artifacts consumed by dashboard and downstream adapters. |
| `Z_caretta` | Optional downstream route contract produced outside Geodynamo. |

## Boundary Rules

Helios should make Geodynamo easier to configure, not more entangled.

- Helios may define fleet scope and default policy.
- Helios may generate or validate Geodynamo config.
- Helios may decide which Geodynamo publications are enabled.
- Helios may declare retention and scheduling intent.
- Helios may declare policy ceilings for downstream consumers.
- Helios should not call Caretta through Geodynamo.
- Helios should not make the dashboard a control surface.
- Helios should not require Geodynamo to import Caretta-specific schemas.
- Helios should not hide raw Geodynamo artifacts behind a higher-level summary.
- Helios should not become a second runtime collector while Geodynamo owns field sensing.

The control path stays downstream and programmatic:

```text
published artifacts -> external adapter -> Caretta CLI / Caretta GitHub Action
```

## Recommended First Experiment

The first experiment should be deliberately small:

1. Create a Helios manifest covering the same repositories currently listed in `geodynamo-projects.json`.
2. Validate required fields: `fleet`, `retentionDays`, `defaults.workflowNames`, `defaults.allowedActions`, and `projects[].repo`.
3. Resolve defaults and project overrides into an effective config.
4. Generate `geodynamo-projects.json` in the current shape.
5. Run the existing Geodynamo workflow without adding a Helios runtime import.
6. Confirm the published artifacts are still neutral and dashboard-only.
7. Compare the generated config against the hand-maintained config for drift.

Success means Geodynamo can run from Helios-provided scope and policy without knowing whether Caretta exists.

## Evaluation Criteria

| Metric | Target direction |
| --- | --- |
| Manual config drift | Lower. |
| Reproducibility of generated config | 100% for same manifest input. |
| Missing required project metadata | Lower over time. |
| Policy conflicts found before Geodynamo run | Higher. |
| Runtime coupling added to Geodynamo | Zero. |
| Dashboard control affordances | Zero. |
| Caretta-specific fields in Geodynamo core config | Zero. |

## Failure Modes

| Failure mode | Effect | Mitigation |
| --- | --- | --- |
| Helios becomes too broad | It turns into a second Geodynamo or hidden control plane. | Keep Helios declarative: scope, policy, schedule, ownership, publication intent. |
| Geodynamo depends on Caretta through Helios | Circular dependency reappears indirectly. | Keep Helios manifests Caretta-neutral. |
| Dashboard gains controls | Publish surface becomes an accidental operations console. | Dashboard remains read-only and links outward only. |
| Policy hides reality | Parent defaults obscure project-specific hazards. | Geodynamo must still publish raw field and snapshot artifacts. |
| Overcentralized schedules | Every project gets the same observation cadence despite different risk. | Allow project-level cadence overrides. |
| Override conflicts are silent | Operators misunderstand effective policy. | Make generated effective policy auditable. |

## Open Questions

- Should Helios start as a manifest file in this repository or a separate repository?
- Should generated `geodynamo-projects.json` be checked in, generated during CI, or both?
- Should project dependency metadata affect priority in v1, or only be published for human review?
- Should Helios own publication destinations, or only publication policy?
- Should non-GitHub signals wait until the Geodynamo field model stabilizes?

## Working Prediction

Helios is useful if it reduces configuration drift and makes field publication more coherent without adding a control dependency. The first proof should be boring: generate the same effective Geodynamo configuration from a clearer upstream manifest, run the same Geodynamo pipeline, and preserve the same artifact boundary for the dashboard and downstream adapters.