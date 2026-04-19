# Tally Architecture

## Overview
Tally will ship as a single full-stack Next.js application using the App Router and TypeScript. The system is designed for multi-tenant payroll review workloads where uploaded source files are normalized into canonical employee-level records, compared against previous runs, and surfaced through a reviewer-first workflow.

The architecture must favor explicit domain modeling, traceability, and safe operational behavior over novelty.

## Chosen Stack
- Next.js App Router for UI, server components, route handlers, and server actions
- TypeScript across the full stack
- Tailwind CSS for styling
- shadcn/ui for repeatable UI primitives
- TanStack Table for dense review tables and exception queues
- Supabase Auth for authentication
- Supabase Postgres as the primary database
- Supabase Storage for uploaded payroll files and generated artifacts
- Prisma for schema management and migrations
- Trigger.dev for async import and rule-processing jobs
- Vercel for hosting and deployment

## Implementation Priorities
1. Establish tenant-safe foundation and auth.
2. Model clients, pay runs, source files, and lineage.
3. Build import preview and mapping workflow.
4. Normalize employee-level canonical records.
5. Build deterministic rules, reviewer queue, drilldown, and approval gating.
6. Add secondary reconciliation and export workflows later.

## Expected App Structure
This repo should remain a single application with clear feature boundaries:

```text
app/
  (marketing-or-auth-minimal if needed)
  dashboard/
    clients/
    pay-runs/
    review/
components/
  ui/
  review/
  imports/
lib/
  auth/
  db/
  tenancy/
  imports/
  mapping/
  review/
  audit/
prisma/
trigger/
fixtures/
  payroll/
```

The exact directories can evolve, but code should stay organized by domain boundary rather than by technical layer alone.

## Auth and Tenant Safety
- Authentication will be handled through Supabase Auth.
- Authorization will be enforced in application logic and database access patterns.
- Every tenant-owned record must carry an organization identifier.
- Queries and mutations must derive organization context from the authenticated user membership, never from unchecked client input alone.
- The system should be compatible with Postgres row-level security, even if the earliest scaffold centralizes some checks in server code first.

## Storage Design
- Uploaded source files live in Supabase Storage.
- Metadata for each upload lives in the relational database.
- Source file records must track tenant, client, pay run, file role, uploader, upload timestamp, checksum, storage location, and parse status.
- Normalized records must never replace the original uploaded file; the original file is part of the audit trail.

## Database and Domain Model
Prisma will manage the schema and migrations against Supabase Postgres.

Core entities for v1:
- `organization`
- `membership`
- `role`
- `client`
- `pay_run`
- `source_file`
- `mapping_template`
- `source_column_mapping`
- `employee_run_record`
- `employee_pay_component`
- `source_row_ref`
- `employee_match`
- `rule_result`
- `review_exception`
- `exception_comment`
- `approval_event`

### Modeling Principles
- Separate immutable derived facts from mutable review state.
- Keep canonical employee-level records independent from uploaded source structure.
- Preserve lineage from each canonical field or component back to source row references where practical.
- Avoid reducing the model to payroll-summary totals because that blocks the primary reviewer workflow.

## Import and Processing Flow
1. User uploads current and previous payroll source files.
2. App stores raw file metadata and object storage location.
3. Preview parser extracts sheet/tab structure, headers, and sample rows.
4. User maps source columns to canonical fields, optionally from a saved template.
5. Background jobs normalize the source into canonical employee records and pay components.
6. Matching jobs align current-run employees with previous-run employees.
7. Rules engine produces immutable rule results.
8. Review state materializes as actionable exceptions for reviewer triage.

## Jobs and Async Processing
Trigger.dev should handle long-running and retryable jobs such as:
- file parsing and preview generation
- canonical normalization
- previous-run matching
- deterministic rule execution
- export generation later

Operational guidance:
- jobs must be idempotent where possible
- job inputs and outputs should reference durable database records
- job failures must produce inspectable statuses, not silent partial state

## Application Surfaces
### Dashboard / Navigation
- client list
- pay run list and status
- review work entry points

### Import Workflow
- create pay run
- upload current and previous files
- inspect previews
- define or apply mappings
- confirm import

### Review Workflow
- reviewer queue using TanStack Table
- filters and sort tuned for operational throughput
- employee drilldown with source evidence
- comments, resolution actions, and approval gating

## Testing Strategy
Practical testing baseline:
- unit tests for mapping, normalization, matching, and deterministic rule logic
- integration tests for tenant-safe data access and review workflows
- component tests for dense review UI where behavior is easy to regress
- end-to-end tests for the core happy path once the first reviewer slice exists

Do not rely on manual QA alone for matching, rule evaluation, or approval gating.

## Deployment
- Deploy the Next.js app on Vercel.
- Use managed Supabase services for auth, database, and storage.
- Run Prisma migrations in a controlled deploy step.
- Configure Trigger.dev with environment-specific credentials and queues.

## Observability and Auditability
- Important lifecycle events should be recorded durably.
- Approval history must be append-only.
- Derived review findings should be reproducible from the source inputs and rule versions in use.
- Logs and monitoring should prioritize import failures, matching gaps, rule failures, and authorization issues.

## Out of Scope for Initial Build
- payroll calculations
- tax logic
- filing/submission flows
- employee self-service
- payment execution
- AI-driven autonomous review decisions
