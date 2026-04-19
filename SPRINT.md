# Sprint 1

## Sprint Goal
Create the first usable Tally foundation for employee-level payroll review without drifting into reconciliation-first or payroll-engine scope.

## Sprint Scope
The first sprint consists of:
- repo scaffold
- tenancy foundation
- pay run and source file shell
- import preview and mapping
- canonical reviewer domain model
- first reviewer slice

## Workstreams
### 1. Repo Scaffold
- initialize Next.js app baseline
- configure TypeScript, Tailwind, shadcn/ui, TanStack Table
- wire Supabase, Prisma, and Trigger.dev foundations
- set project conventions and developer scripts

### 2. Tenancy Foundation
- implement organizations, memberships, and roles
- establish org-scoped auth patterns
- ensure client and pay run resources inherit tenant boundaries

### 3. Pay Run and Source File Shell
- create client and pay run domain shell
- support current and previous source file metadata
- preserve lineage-ready storage metadata and statuses

### 4. Import Preview and Mapping
- upload CSV/XLSX files
- inspect preview rows and headers
- apply field mappings or mapping templates
- prepare normalization jobs from approved mappings

### 5. Canonical Reviewer Domain Model
- model employee run records, pay components, source row refs, matching, rule results, review exceptions, comments, and approval events
- keep immutable result state separate from mutable review state

### 6. First Reviewer Slice
- generate deterministic review exceptions from current-vs-previous data
- render dense reviewer queue
- render employee drilldown with source-row evidence
- allow resolve/comment flows
- block approval when gating conditions fail

## Sprint Exit Criteria
- The repo has a working application scaffold on the chosen stack.
- Multi-tenant foundations are in place for organization-scoped access.
- Users can create a pay run and attach current/previous source files.
- Users can preview and map uploaded files.
- The canonical reviewer data model exists in the database schema.
- A first end-to-end reviewer slice exists from import through exception triage and approval gating.

## Explicit Exclusions
- payroll calculations
- tax rules
- filing/submission
- payment execution
- reconciliation-first dashboards
- AI-assisted review decisions
