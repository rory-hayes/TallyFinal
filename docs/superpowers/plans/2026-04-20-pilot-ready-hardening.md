# Pilot-Ready Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing reviewer-first payroll slice pilot-ready with explicit processing/rerun handling, secondary exports, large-table hardening, and updated docs/tests.

**Architecture:** Keep the employee-level review model primary. Add a pay-run review snapshot/process layer so reruns and replacements can generate fresh active reviewer data without overwriting prior immutable facts. Keep exports read-only and sourced from durable review/audit records. Use Trigger.dev as the async boundary for payroll processing and export generation when configured, with a practical inline fallback for local development.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Supabase Auth/Storage, Trigger.dev, TanStack Table, Vitest, pdf-lib (for PDF generation).

---

### Task 1: Add pay-run processing state and snapshot versioning

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_pilot_ready_processing/migration.sql`
- Test: `tests/pay-runs/processing-state.test.ts`

- [ ] Add pay-run processing fields and active review snapshot version to the schema.
- [ ] Add the matching migration.
- [ ] Add tests for derived processing state helpers.

### Task 2: Wire payroll normalization, matching, and rule materialization into a reusable service

**Files:**
- Create: `lib/pay-runs/processing.ts`
- Modify: `lib/review/exceptions.ts`
- Modify: `lib/review/approval.ts`
- Test: `tests/pay-runs/processing.test.ts`

- [ ] Add a service that loads the latest mapped payroll source files, normalizes them, persists canonical reviewer facts, materializes matches/rules/exceptions, and advances the pay run snapshot.
- [ ] Keep reruns explicit and lineage-safe by creating a fresh snapshot instead of mutating prior facts.
- [ ] Add unit tests for successful processing, validation failures, and rerun snapshot advancement.

### Task 3: Add Trigger.dev orchestration and inline fallback

**Files:**
- Create: `trigger/payroll-review-processing.ts`
- Modify: `lib/env.ts`
- Create: `lib/supabase/admin.ts`
- Test: `tests/env.test.ts`

- [ ] Add a Trigger.dev task that runs payroll review processing by durable pay-run/source identifiers.
- [ ] Add an enqueue helper that uses Trigger.dev when configured and inline processing otherwise.
- [ ] Add the env/service-role support needed for background storage reads.

### Task 4: Make mapping/upload flows explicitly queue or rerun reviewer processing

**Files:**
- Modify: `app/(authenticated)/app/orgs/[orgSlug]/clients/[clientId]/pay-runs/actions.ts`
- Modify: `lib/imports/service.ts`
- Modify: `lib/pay-runs/service.ts`
- Test: `tests/imports/service.test.ts`

- [ ] Mark payroll processing as stale when source files are replaced or mappings change.
- [ ] Queue reviewer processing only when both payroll files are uploaded and mapped.
- [ ] Improve mutation error messages so the user can tell what is missing or failed.

### Task 5: Add read-only export services and routes

**Files:**
- Create: `lib/exports/csv.ts`
- Create: `lib/exports/service.ts`
- Create: `lib/exports/pdf.ts`
- Create: `app/api/pay-runs/[payRunId]/exports/exceptions/route.ts`
- Create: `app/api/pay-runs/[payRunId]/exports/reconciliation/route.ts`
- Create: `app/api/pay-runs/[payRunId]/exports/sign-off/route.ts`
- Create: `app/api/pay-runs/[payRunId]/exports/audit/route.ts`
- Test: `tests/exports/service.test.ts`

- [ ] Add exception CSV export sourced from active review exceptions.
- [ ] Add reconciliation summary CSV export sourced from the existing secondary summary rows.
- [ ] Add sign-off PDF export sourced from approval/review metadata.
- [ ] Add audit export with pay run context, source lineage, processing history, reviewer exceptions, comments, and approval events.

### Task 6: Surface processing state, reruns, and exports in the pay-run UI

**Files:**
- Modify: `app/(authenticated)/app/orgs/[orgSlug]/clients/[clientId]/pay-runs/[payRunId]/page.tsx`
- Modify: `components/review/pay-run-approval-panel.tsx`
- Create: `components/review/pay-run-processing-panel.tsx`

- [ ] Add a panel showing whether reviewer processing is ready, queued, failed, or completed.
- [ ] Show the active snapshot/source versions so replacements and reruns are explicit.
- [ ] Add secondary export actions without displacing the queue and drilldown from the top of the page.

### Task 7: Harden large review tables and shared UI error states

**Files:**
- Modify: `components/review/review-queue-workspace.tsx`
- Modify: `components/tables/data-table.tsx`
- Test: `tests/review/queue-pagination.test.ts`

- [ ] Add pagination for the review queue and shared data table.
- [ ] Keep selection/filtering stable across large data sets.
- [ ] Improve empty/error copy for reviewer and reconciliation workspaces.

### Task 8: Update docs and verification coverage

**Files:**
- Modify: `README.md`
- Modify: `roadmap.md`
- Modify: `SPRINT.md`
- Create or Modify: `docs/launch-checklist.md`
- Test: `tests/pay-runs/processing-smoke.test.ts`

- [ ] Update local setup, Trigger.dev, service-role, and developer workflow guidance.
- [ ] Add launch-readiness checklist items for exports, reruns, storage, and job workers.
- [ ] Add a smoke-style processing/export test and run lint, typecheck, and targeted tests before completion.
