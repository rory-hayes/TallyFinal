# Tally

Tally is a multi-tenant payroll review, reconciliation, and sign-off app for payroll bureaus and payroll-focused accounting teams. The product is reviewer-first: the main v1 workflow is employee-level current-vs-previous payroll review with deterministic exceptions, source evidence, reviewer comments, and approval gating.

## Product shape

- Reviewer queue and drilldown are the primary workflow.
- Reconciliation and exports are secondary surfaces built from the review model.
- Source lineage is explicit from uploaded file versions through canonical reviewer records.
- Reruns create a fresh active reviewer snapshot instead of overwriting prior facts.

## Core docs

- [prompts.md](/Users/rory/TallyFinal/prompts.md)
- [PRD.md](/Users/rory/TallyFinal/PRD.md)
- [ARCHITECTURE.md](/Users/rory/TallyFinal/ARCHITECTURE.md)
- [AGENTS.md](/Users/rory/TallyFinal/AGENTS.md)
- [SPRINT.md](/Users/rory/TallyFinal/SPRINT.md)
- [DECISIONS.md](/Users/rory/TallyFinal/DECISIONS.md)
- [roadmap.md](/Users/rory/TallyFinal/roadmap.md)
- [launch-checklist.md](/Users/rory/TallyFinal/docs/launch-checklist.md)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env defaults:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the required values in `.env.local`:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `TALLY_SOURCE_FILES_BUCKET`

   `TRIGGER_PROJECT_REF` and `TRIGGER_SECRET_KEY` are optional for local development. If they are missing, payroll reviewer processing runs inline. If they are present, processing runs through Trigger.dev.

4. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Apply the database schema locally:

   ```bash
   npx prisma migrate dev
   ```

6. Start the web app:

   ```bash
   npm run dev
   ```

7. Optionally start the Trigger.dev worker in a second terminal:

   ```bash
   npm run trigger:dev
   ```

The authenticated app shell lives at `/app`. The health endpoint lives at `/api/health`.

## Environment notes

- `SUPABASE_SERVICE_ROLE_KEY` is required for reviewer processing and exports because those jobs need detached storage reads.
- Trigger.dev is the async boundary for payroll snapshot processing when configured.
- Without Trigger.dev, the same processing code runs inline after payroll mappings are saved.
- Current and previous payroll files must both be uploaded and mapped before the reviewer snapshot can build.

## Reviewer workflow

1. Create an organization and client.
2. Create a pay run.
3. Upload current and previous payroll source files.
4. Preview each file and save mappings.
5. Let reviewer processing build the active snapshot.
6. Work the reviewer queue and employee drilldowns.
7. Submit and approve the active reviewer snapshot.
8. Export exceptions, reconciliation summary, sign-off PDF, or audit data as needed.

Replacing a payroll source file creates a new file version and makes the reviewer snapshot stale until processing reruns against the latest mapped inputs.

## Exports

Exports remain secondary to the review workflow:

- Exception CSV
- Reconciliation summary CSV
- Sign-off PDF for approved snapshots
- Audit JSON export with source files, processing runs, reviewer exceptions, comments, and approval events

## Available scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run prisma:generate`
- `npm run prisma:studio`
- `npm run trigger:dev`
- `npm run trigger:deploy`

## Developer workflow

1. Start from a fresh branch for each implementation prompt.
2. Keep changes tied to the employee-level reviewer model.
3. Run the relevant checks before finishing:

   ```bash
   npm run test
   npm run typecheck
   npm run build
   ```

4. Manually smoke the pilot-critical flow:

   - upload current and previous payroll files
   - save mappings
   - confirm reviewer processing completes
   - review queue and drilldown load on the active snapshot
   - approve the pay run
   - export exception CSV, reconciliation CSV, sign-off PDF, and audit export
   - replace a payroll file and verify the snapshot becomes stale, then rebuilds

## Fixtures

The repo includes anonymized fixtures under [/Users/rory/TallyFinal/fixtures/payroll](/Users/rory/TallyFinal/fixtures/payroll) and [/Users/rory/TallyFinal/fixtures/reconciliation](/Users/rory/TallyFinal/fixtures/reconciliation) for normalization, rules, and reconciliation tests.

## Working rules

- Work one implementation prompt at a time.
- Preserve tenant boundaries and auditability.
- Keep immutable facts separate from mutable reviewer state.
- Stop and fix docs first if docs and code diverge.
