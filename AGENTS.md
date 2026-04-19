# Tally Build Rules For Codex

## Product Truth
- Tally is an employee-level payroll review and sign-off product first.
- The primary workflow is current-vs-previous payroll review at employee level.
- Reconciliation is secondary and must not shape the primary UX before the reviewer workflow exists.
- Exports are secondary and must not displace the review domain model.

## Hard Rules
- Do not build reconciliation-first UX before the reviewer workflow exists.
- Do not add payroll engine logic, gross-to-net calculation logic, or tax engine behavior.
- Do not add filing or submission workflows.
- Do not add AI to the critical path.
- Prefer explicit, boring implementations over clever abstractions.
- Preserve auditability, source lineage, and multi-tenant safety in every design choice.
- Keep immutable facts separate from mutable reviewer state.
- Stop and flag doc/code conflicts instead of guessing.

## Engineering Rules
- Follow the architecture baseline in `ARCHITECTURE.md` unless the docs are intentionally updated first.
- Use a single full-stack Next.js repo.
- Favor server-side enforcement for authorization and tenant scoping.
- Keep each feature tied to the canonical employee-level review model.
- Do not introduce summary-only data structures as the primary review abstraction.

## Domain Modeling Rules
- `employee_run_record` is a first-class entity, not a derived afterthought.
- `employee_pay_component` exists to support explainable employee-level comparisons.
- `rule_result` must remain immutable once created.
- `review_exception` carries mutable triage state separate from rule computation.
- `source_row_ref` and related lineage data are required wherever review evidence depends on imported source values.

## Workflow Rules
- Work one implementation prompt at a time.
- Start each implementation prompt from its own branch.
- Review, test, and commit after each completed implementation prompt.
- If implementation reveals a product-direction conflict, stop and fix the docs first.

## UI Rules
- Optimize for dense reviewer throughput, not decorative dashboards.
- Make source evidence easy to inspect from queue and drilldown views.
- Do not design around journal reconciliation before the reviewer slice is real.

## Safety Rules
- Never weaken tenant boundaries for convenience.
- Never mutate historical approval events.
- Never hide deterministic rule logic behind opaque automation.
