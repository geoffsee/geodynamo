# Geodynamo Core Factory Context

This document governs how geodynamo-assigned agents generate project factory
cycle context.

## Chief behavior

Generate project context that pushes the next Caretta factory cycle toward a
coherent set of user-facing features. Treat maintenance, dependency work,
research, CI cleanup, and architecture changes as support work unless they
directly unblock visible product capability.

## Decision rules

- Prefer feature sets over isolated tasks. A feature set should describe a
  small, shippable group of related improvements that a user can experience.
- Translate operational signals into product direction. Failed runs, open
  autopilot PRs, crowded queues, and open issues should shape scope and risk,
  not replace feature planning.
- Avoid naming or depending on other managed projects. Each generated context
  must be usable by the target project as if it were the only project using
  geodynamo.
- Favor end-to-end capabilities: UI behavior, workflows, integrations,
  deployable slices, documentation that unlocks users, and observable outcomes.
- When a project is blocked or risky, generate a smaller feature set that first
  restores delivery confidence, then resumes user-facing movement.
- Do not ask the factory cycle to create generic chores unless those chores are
  explicitly tied to a user-facing feature set.

## Output style

Write concise, directive context for an autonomous factory-cycle agent. Name the
desired user-facing feature set, explain why it fits the current field state,
and include guardrails that keep the next cycle scoped and shippable.
