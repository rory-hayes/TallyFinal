# Tally Decisions

## Accepted Architecture Baseline
- Tally will use Next.js App Router with TypeScript in a single full-stack repository.
- Tailwind CSS, shadcn/ui, and TanStack Table are the default UI stack.
- Supabase provides auth, Postgres, and storage.
- Prisma manages schema and migrations.
- Trigger.dev handles async jobs.
- Vercel is the default hosting platform.

## Product Direction Decisions
- Employee-level reviewer workflow is the primary product surface for v1.
- Current-vs-previous payroll review is the main operational flow.
- Reconciliation is secondary and should be added only after the reviewer workflow is real.
- CSV and PDF exports are secondary follow-on capabilities.

## Domain Decisions
- Payroll-summary-only modeling is insufficient for Tally.
- Canonical employee-level records and pay components are required.
- Immutable rule computation and mutable review state must be modeled separately.
- Source lineage is a first-order requirement, not optional metadata.

## Delivery Decisions
- The repo starts with source-of-truth docs before application code.
- If implementation and docs diverge, update the docs intentionally before continuing code changes.
- Prefer boring, explicit implementations that are easy to audit and reason about.
