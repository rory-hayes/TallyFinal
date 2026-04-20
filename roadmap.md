# Tally v1 Roadmap

## Milestone 0: Source Of Truth
### Goal
Lock the product direction, architecture baseline, and Codex guardrails before application code exists.

### Tasks
- create PRD, architecture, sprint, decisions, roadmap, and agent docs
- keep prompt runbook in repo root
- align all docs on reviewer-first product scope

### Acceptance Criteria
- root docs exist and are internally consistent
- reviewer-first direction is explicit
- reconciliation-first drift is clearly blocked

## Milestone 1: Application Baseline
### Goal
Stand up the full-stack Next.js application with the agreed services and developer workflow.

### Tasks
- scaffold Next.js App Router app
- add Tailwind and shadcn/ui
- add TanStack Table
- configure Supabase, Prisma, Trigger.dev, and Vercel expectations
- establish lint, typecheck, test, and build scripts

### Dependencies
- Milestone 0 complete

### Acceptance Criteria
- app boots locally
- base scripts run successfully
- environment contract is documented

## Milestone 2: Tenancy And Client Foundations
### Goal
Create the tenant-safe operational shell for organizations and clients.

### Tasks
- add organization, membership, and role models
- add auth integration and org selection patterns
- add client CRUD shell

### Dependencies
- Milestone 1 complete

### Acceptance Criteria
- authenticated users can only access org-scoped data
- clients are partitioned by organization

## Milestone 3: Pay Runs And Source Files
### Goal
Model the operational unit of review and attach lineage-preserving source uploads.

### Tasks
- add pay run model and lifecycle states
- add source file model and storage metadata
- support separate current and previous file roles

### Dependencies
- Milestone 2 complete

### Acceptance Criteria
- user can create a pay run for a client
- user can attach current and previous source files
- uploads retain audit-ready metadata

## Milestone 4: Import Preview And Mapping
### Goal
Make upload-first onboarding real through previewable, reusable mappings.

### Tasks
- parse CSV/XLSX previews
- inspect headers and sample rows
- create and apply source mappings
- save mapping templates

### Dependencies
- Milestone 3 complete
- fixture payroll files available under `fixtures/payroll/`

### Acceptance Criteria
- user can preview both files before normalization
- mappings can be saved and reused
- malformed headers and messy samples are still reviewable

## Milestone 5: Canonical Reviewer Domain
### Goal
Materialize the employee-level model needed for deterministic review.

### Tasks
- add employee run record model
- add employee pay component model
- add source row reference model
- add previous-run matching model
- add immutable rule result model
- add stateful review exception model
- add exception comment and approval event models

### Dependencies
- Milestone 4 complete

### Acceptance Criteria
- canonical records can represent employee-level payroll values from source files
- source evidence can be traced back to imported rows
- immutable findings and mutable reviewer actions are separated cleanly

## Milestone 6: First Reviewer Slice
### Goal
Ship the first true reviewer workflow from comparison to gated approval.

### Tasks
- match current employees to previous employees
- run deterministic field-level variance checks
- create review exceptions from rule results
- build dense reviewer queue
- build employee drilldown with source-row evidence
- add comments, resolution flow, and approval gating

### Dependencies
- Milestone 5 complete

### Acceptance Criteria
- reviewer can see actionable exceptions for a pay run
- reviewer can inspect a single employee with field deltas and source evidence
- reviewer can resolve or comment on exceptions
- approval is blocked when unresolved gating exceptions remain

## Milestone 7: Secondary Workflows
### Goal
Add secondary capabilities without displacing the reviewer-first core.

### Tasks
- journal reconciliation
- payment reconciliation
- CSV exports
- PDF exports

### Dependencies
- Milestone 6 complete

### Acceptance Criteria
- secondary workflows reuse the reviewer-first domain model
- reviewer queue and drilldown remain the primary product surface
- pilot hardening keeps reruns explicit, exports useful, and lineage intact

## Manual Inputs Needed
- at least 2 anonymized Irish current/previous payroll CSV pairs
- at least 1 messy sample with awkward headers or formatting
- stored under `fixtures/payroll/`
- human review of docs before each major merge
