
# prompts.md
## Tally Codex Runbook
**Purpose:** Copy-paste prompt runbook for rebuilding Tally cleanly as a solo founder.
**Working style:** one prompt at a time, review after every implementation, commit between each merge.
**Product:** employee-level payroll review and sign-off platform for Ireland-first payroll bureaus, with UK-ready design constraints.

---

# 0. How to use this file properly

## 0.1 Ground rules
- Work from a **fresh repo**.
- Keep this file in the **repo root**.
- Run **one implementation prompt at a time**.
- Use **Ask mode** for planning/review prompts.
- Use **Code mode** for implementation prompts.
- Review, test, and commit after every completed implementation prompt.
- Do **not** let Codex change the product direction mid-build.
- If Codex says docs and code conflict, stop and fix the docs first.

## 0.2 Default workflow for every implementation prompt
1. Create a branch.
   - Example: `git checkout -b feat/tally-p03-pay-runs`
2. Paste the prompt into Codex.
3. Let Codex finish.
4. Read the summary carefully.
5. Run local checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
6. Run the **Review Prompt** in Ask mode.
7. If the review finds issues, run the **Fix Prompt**.
8. Re-run local checks.
9. Commit changes.
10. Merge only when you are satisfied.
11. Mark the prompt done in this file.

## 0.3 Suggested commit style
Use simple commit messages:
- `docs: create Tally source-of-truth docs`
- `feat: scaffold Tally app baseline`
- `feat: add org and client foundation`
- `feat: add pay run and source file models`
- `feat: add mapping templates and preview parsing`
- `feat: add employee reviewer domain model`

## 0.4 Product guardrails
Tally v1 is:
- a **web app**
- an **employee-level payroll review and sign-off** product first
- **Ireland-first**, with UK-ready design constraints
- **upload-first**
- **deterministic-rules-first**
- **auditability-first**
- **reviewer-first**

Tally v1 is **not**:
- payroll processing software
- a gross-to-net calculator
- a tax engine
- a filing/submission product
- an HRIS
- a payments platform
- an AI autopilot
- a reconciliation-first close-pack tool

The core workflow is:
1. create org/client/pay run
2. upload current payroll CSV
3. upload previous payroll CSV
4. preview and map files
5. normalize into employee-level canonical records
6. match current to previous employees
7. generate deterministic field-level review exceptions
8. triage exceptions in a dense reviewer queue
9. inspect employee drilldown with source-row evidence
10. resolve/comment and approve with gating

## 0.5 Architecture baseline for the fresh restart
Use this as the default stack unless you explicitly decide otherwise:
- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **TanStack Table**
- **Supabase** for auth, Postgres, and storage
- **Prisma** for schema/migrations
- **Trigger.dev** for async jobs
- **Vercel** for hosting

Use a **single full-stack Next.js repo**, not a separate Python backend.

## 0.6 Human tasks you still need to do manually
Before deeper payroll logic:
- provide at least **2 anonymized current/previous Irish payroll CSV pairs**
- provide at least **1 messy sample** with awkward headers/formatting
- store them under `fixtures/payroll/`
- review generated docs before implementation starts
- review every merge yourself

---

# 1. Ordered prompt list

---

## [x] P00 — Create the source-of-truth docs
**Mode:** Code
**When to run:** first
**Goal:** create the operating system for the repo before app code exists

```text
You are initializing a fresh repo for Tally.

Do not write app code yet.

Create or overwrite these files in the repo root:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md
- README.md

Use this product definition as the source of truth:

Tally is a multi-tenant web app for payroll review, reconciliation, and sign-off for Ireland-first payroll bureaus and payroll-focused accounting teams, with UK-ready design constraints.

The primary workflow is employee-level payroll review:
- upload current payroll CSV
- upload previous payroll CSV
- preview and map fields
- normalize into employee-level canonical records
- compare current vs previous payroll
- run deterministic field-level variance checks
- triage reviewer exceptions
- inspect employee drilldown with source-row evidence
- comment, resolve, and approve with gating

Core v1 capabilities:
- orgs, memberships, roles
- clients
- pay runs
- source files and lineage
- CSV/XLSX preview and mapping
- mapping templates
- employee_run_record
- employee_pay_component
- source_row_ref
- previous-run matching
- immutable rule_result
- stateful review_exception
- exception_comment
- approval_event
- reviewer queue
- employee drilldown
- auditability
- secondary journal/payment reconciliation later
- CSV/PDF exports later

Non-goals:
- payroll calculation
- tax engine
- filing/submission engine
- HRIS
- employee portal
- payments platform
- AI in the critical path

Architecture baseline:
- Next.js App Router + TypeScript
- Tailwind
- shadcn/ui
- TanStack Table
- Supabase for auth, Postgres, storage
- Prisma for schema/migrations
- Trigger.dev for async jobs
- Vercel for hosting
- single full-stack Next.js repo

Requirements for the docs:
1. PRD.md
   - define the product clearly
   - make employee-level current-vs-previous review the primary workflow
   - make reconciliation secondary
   - make exports secondary
   - include v1 scope, non-goals, users, UX principles, acceptance criteria

2. ARCHITECTURE.md
   - describe the chosen stack
   - explain app structure, auth, storage, db, jobs, testing, deployment
   - include core domain entities
   - keep it practical and implementation-oriented

3. AGENTS.md
   - define build rules for Codex
   - hard rules:
     - Tally is an employee-level payroll review product first
     - do not build reconciliation-first UX before reviewer workflow exists
     - do not add payroll engine logic
     - do not add AI to the critical path
     - prefer explicit, boring implementations
     - preserve auditability and multi-tenant safety
     - stop and flag doc/code conflicts instead of guessing

4. SPRINT.md
   - define the first sprint as:
     - repo scaffold
     - tenancy foundation
     - pay run and source file shell
     - import preview/mapping
     - canonical reviewer domain model
     - first reviewer slice

5. DECISIONS.md
   - record the accepted architecture baseline
   - record that employee-level reviewer workflow is primary
   - record that reconciliation is secondary
   - record that payroll-summary-only modeling is insufficient

6. roadmap.md
   - create milestones and task list for v1
   - include dependencies and acceptance criteria
   - include the first true reviewer slice explicitly

7. README.md
   - explain what Tally is
   - explain local setup expectations
   - point developers to the root docs

Be clear, exact, and implementation-focused.
At the end, summarize the files created and the most important guardrails.
```

**What to review before merging**
- Are the docs aligned with the reviewer-first product?
- Does `AGENTS.md` clearly block the old reconciliation-first drift?
- Is the architecture baseline explicit?
- Is the roadmap practical?

---

## [x] P01 — Scaffold the app baseline
**Mode:** Code
**When to run:** after P00
**Goal:** create a clean full-stack Next.js baseline

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md
- README.md

Create the initial Tally app baseline.

Scope:
- single full-stack Next.js App Router project
- TypeScript
- Tailwind CSS
- shadcn/ui setup
- TanStack Table dependency and wrapper setup
- Supabase client/server utilities
- Prisma setup and initial schema wiring
- Trigger.dev scaffold/config only
- env example file
- lint/typecheck/test/build scripts
- base app layout
- authenticated app shell placeholder
- shared UI wrappers and design tokens
- a simple health/home page inside the authenticated app shell

Out of scope:
- org/client/pay run features
- payroll domain features
- import parsing
- reviewer workflows
- reconciliation
- exports

Constraints:
- keep the repo simple
- do not create a monorepo unless absolutely necessary
- prefer a single Next.js project at the repo root
- keep code explicit and easy to review
- do not invent product features
- align with AGENTS.md

Definition of done:
- app runs locally
- lint, typecheck, test, build scripts exist
- Tailwind and shadcn are configured
- Supabase utilities are scaffolded
- Prisma is scaffolded
- Trigger.dev is scaffolded but not deeply implemented
- env example exists
- base authenticated app shell exists

At the end, provide:
- summary of what was built
- files changed
- scripts available
- any assumptions made
```

**What to review before merging**
- Is the stack what you actually want?
- Is the repo simple enough for a solo founder?
- Do the scripts work?

---

## [x] P02 — Build auth, org, membership, and client foundation
**Mode:** Code
**When to run:** after P01
**Goal:** create tenancy and role-safe business foundations

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement the org, membership, role, and client foundation for Tally.

In scope:
- Supabase auth integration for signed-in access
- organization model
- organization_member model
- roles: admin, reviewer, operator, viewer
- client model
- protected app routes
- org onboarding flow
- client list/create/edit/view flow
- multi-tenant isolation
- Prisma schema/migrations
- server-side auth/permission helpers
- tests for role enforcement and org isolation

Out of scope:
- pay runs
- source files
- payroll imports
- reviewer workflows
- reconciliation
- exports

Constraints:
- stay strictly within scope
- preserve multi-tenant safety
- do not add product features outside tenancy/client foundation
- keep code boring and reviewable
- prefer server-side permission checks over UI-only gating

Definition of done:
- signed-in user can create or access an org
- org members and roles exist
- client CRUD works
- routes are protected
- tenant isolation is enforced
- tests cover critical auth and role boundaries

At the end, provide:
- summary of changes
- files changed
- migrations added
- tests added
- follow-up issues discovered
```

**What to review before merging**
- Are roles correct?
- Is tenant isolation explicit?
- Are permissions checked server-side?

---

## [x] P03 — Build pay run and source file shell
**Mode:** Code
**When to run:** after P02
**Goal:** create pay runs and upload lineage before payroll logic

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement the pay run and source file shell for Tally.

In scope:
- pay_run model
- pay run statuses
- create/list/detail pay run screens
- source_file model
- source kinds:
  - current_payroll
  - previous_payroll
  - journal
  - payment
- secure upload registration
- Supabase storage wiring for uploaded files
- file metadata persistence
- source file lineage fields:
  - replacement_of
  - version
  - checksum/hash
- pay run detail page showing attached source files
- tests for pay run creation and source file persistence

Out of scope:
- actual payroll parsing
- mapping
- normalization
- rules
- reconciliation logic
- exports

Constraints:
- keep source file lineage first-class
- do not silently overwrite files
- do not implement full processing yet
- preserve auditability

Definition of done:
- user can create a pay run for a client
- user can register/upload source files to a pay run
- source files are stored with metadata and lineage fields
- pay run detail screen shows file records
- tests cover pay run and source file flows

At the end, provide:
- summary of changes
- files changed
- migrations added
- tests added
- follow-up issues discovered
```

**What to review before merging**
- Does the pay run model feel right?
- Are source file kinds and lineage clear?
- Are uploads safely tracked?

---

## [ ] P04 — Build preview parsing and mapping templates
**Mode:** Code
**When to run:** after P03
**Goal:** make upload-first workflows real before normalization

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement preview parsing and mapping templates for uploaded CSV/XLSX files.

In scope:
- CSV/XLSX preview parsing
- header extraction
- sample row preview
- basic validation errors for malformed files
- import profile registry with at least:
  - generic Irish payroll CSV
  - generic journal CSV
  - generic payment CSV
- mapping UI
- required-field validation
- mapping template persistence per client/profile/source kind
- mapping template reuse on repeat uploads
- tests for malformed files, required field validation, and template reuse

Out of scope:
- canonical employee normalization
- previous-run matching
- rules engine
- reviewer queue
- reconciliation calculations

Constraints:
- keep mapping UX practical, not fancy
- do not auto-normalize yet
- fail loudly on malformed inputs
- save templates cleanly for repeat payroll workflows

Definition of done:
- uploaded file can be previewed
- headers and sample rows render
- malformed files show useful errors
- mapping can be completed and saved
- saved mapping can be reused on the next upload
- tests cover key edge cases

At the end, provide:
- summary of changes
- files changed
- tests added
- any new fixture expectations
```

**What to review before merging**
- Is the mapping UX usable?
- Can you imagine a payroll operator using it repeatedly?
- Are error states explicit?

**Human step before P05/P06**
Add anonymized payroll fixture files into:
- `fixtures/payroll/current/`
- `fixtures/payroll/previous/`

Minimum:
- 2 current/previous pairs
- 1 messy sample

---

## [ ] P05 — Scaffold the canonical reviewer domain model
**Mode:** Code
**When to run:** after P04
**Goal:** put the correct heart into the product

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement the canonical reviewer domain model for Tally.

In scope:
- add/scaffold these core entities:
  - employee_run_record
  - employee_pay_component
  - source_row_ref
  - employee_match
  - rule_result
  - review_exception
  - exception_comment
  - approval_event (if not already present in compatible form)
- connect them correctly to:
  - organization
  - client
  - pay_run
  - source_file
- explicitly mark any payroll-summary-only model as non-canonical or remove it if not needed
- add migrations
- add persistence tests and relationship tests
- update any schema docs/types that need to reflect the new model

Out of scope:
- full normalization logic
- previous-run ingestion implementation
- rules engine implementation
- exception UI
- reconciliation logic

Constraints:
- employee-level reviewer model is primary
- reconciliation must not shape the model
- rule_result must be immutable by design
- review_exception must carry state separately from engine truth
- keep the model minimal but correct

Definition of done:
- canonical reviewer entities exist
- migrations apply cleanly
- relationships are coherent
- tests cover creation and linkage
- the repo no longer centers on summary-only payroll abstractions

At the end, provide:
- summary of changes
- files changed
- migrations added
- tests added
- follow-up issues discovered
```

**What to review before merging**
- Is this truly employee-first?
- Did Codex accidentally smuggle in reconciliation-first assumptions?
- Are immutable rule results separated from review state?

---

## [ ] P06 — Build current/previous payroll normalization and matching
**Mode:** Code
**When to run:** after P05
**Goal:** turn mapped files into reviewer-ready employee records

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement current/previous payroll normalization and previous-run matching.

In scope:
- dataset roles:
  - current
  - previous
- normalization pipeline from mapped generic Irish payroll CSV into:
  - employee_run_record
  - employee_pay_component
  - source_row_ref
- previous-run matching precedence:
  - employee external ID first
  - payroll number second
  - exact full-name fallback with low-confidence flag
- explicit handling for:
  - new employee
  - missing employee
  - ambiguous match
  - duplicate names
- fixture-based tests using repo fixtures
- error handling for malformed or incomplete mapped inputs

Out of scope:
- rules engine
- review queue UI
- reconciliation
- exports

Constraints:
- use deterministic matching only
- do not hide ambiguous matches
- preserve source-row evidence
- use fixture-based tests, not toy-only tests
- do not broaden to vendor-specific logic beyond the generic Irish path unless clearly necessary

Definition of done:
- current payroll can normalize into canonical reviewer records
- previous payroll can normalize into canonical reviewer records
- current records can match to previous deterministically
- ambiguous/unmatched cases are explicit
- tests cover happy path and messy inputs

At the end, provide:
- summary of changes
- files changed
- tests added
- any fixture gaps discovered
```

**What to review before merging**
- Does matching precedence behave exactly as intended?
- Are ambiguous cases surfaced?
- Is evidence preserved?

---

## [ ] P07 — Build deterministic rules engine and reviewer exception backend
**Mode:** Code
**When to run:** after P06
**Goal:** generate actionable review work from current-vs-previous comparison

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement the first deterministic reviewer rules engine and exception backend.

In scope:
- immutable rule_result generation
- derive review_exception from rule_result
- initial rules:
  - gross variance threshold
  - net variance threshold
  - tax variance threshold
  - pension variance threshold
  - hours variance threshold
  - new employee
  - missing employee
  - zero pay anomaly
  - duplicate identifier
- exception filtering/query endpoints
- bulk resolve / ignore actions
- exception comments backend
- audit logging for exception state changes
- tests for deterministic rule behavior and exception lifecycle

Out of scope:
- dense reviewer UI
- employee drilldown UI
- approval gating UI
- reconciliation rules

Constraints:
- rule_result is engine truth and immutable
- review_exception is reviewer state
- severity must be deterministic
- no AI explanations
- no reconciliation-first logic

Definition of done:
- rules run deterministically on normalized data
- review exceptions are created and queryable
- bulk state changes work
- comments work
- audit trail exists for exception state changes
- tests cover rule and exception lifecycle edge cases

At the end, provide:
- summary of changes
- files changed
- tests added
- follow-up issues discovered
```

**What to review before merging**
- Are rules deterministic and explainable?
- Are reviewer state and engine truth properly separated?
- Is the exception lifecycle believable?

---

## [ ] P08 — Build the reviewer queue workspace
**Mode:** Code
**When to run:** after P07
**Goal:** create the first dense operator-facing review surface

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement the reviewer queue workspace.

In scope:
- pay run review overview
- severity counts
- exception table
- filters:
  - severity
  - status
  - employee
  - rule type
- bulk actions:
  - resolve
  - ignore
  - assign if supported
- clear row-level navigation into employee drilldown
- dense table-first UX using TanStack Table
- tests for core queue interactions if practical

Out of scope:
- employee drilldown implementation
- approval gating
- reconciliation workspace
- exports polish

Constraints:
- optimize for operational use, not marketing polish
- keep the UI dense but readable
- reviewer queue is the primary workspace
- do not build a wizard-first experience here

Definition of done:
- user can open a pay run and triage exceptions in one queue
- filters work
- bulk actions work
- row-to-drilldown navigation is in place
- the workspace clearly feels like reviewer software

At the end, provide:
- summary of changes
- files changed
- tests added
- UX tradeoffs made
```

**What to review before merging**
- Does this feel better than spreadsheets for triage?
- Is the information density right?
- Is the default view “what needs attention now?”

---

## [ ] P09 — Build employee drilldown and approval gating
**Mode:** Code
**When to run:** after P08
**Goal:** finish the first true reviewer slice

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement employee drilldown and approval gating.

In scope:
- employee drilldown screen
- current vs previous values view
- changed fields highlighted clearly
- normalized pay component view
- source-row evidence view
- exception comments in drilldown
- resolve/ignore actions from drilldown
- pay run submit/review/approve flow
- block approval when unresolved high-severity exceptions remain
- reviewer/admin-only approval permissions
- override notes if allowed by docs
- tests for approval gating and permission enforcement

Out of scope:
- journal/payment reconciliation
- export pack polish
- advanced analytics

Constraints:
- employee evidence must be easy to understand
- approval must be trustworthy and auditable
- do not blur reviewer/operator permissions
- do not expand into reconciliation-first UX

Definition of done:
- user can open drilldown from queue
- user can inspect current vs previous values and source evidence
- user can comment/resolve
- approval is gated correctly
- reviewer/admin permissions are enforced
- tests cover critical approval and permission flows

At the end, provide:
- summary of changes
- files changed
- tests added
- follow-up issues discovered
```

**What to review before merging**
- Is this now a real reviewer product?
- Is approval gating strict enough?
- Is evidence credible and traceable?

---

## [ ] P10 — Add secondary reconciliation support
**Mode:** Code
**When to run:** after P09
**Goal:** add journal/payment reconciliation as secondary capability

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Implement secondary reconciliation support without changing the reviewer-first center of the product.

In scope:
- journal import normalization
- payment import normalization
- reconciliation_check model/service
- payroll-to-journal summary checks
- payroll-to-payment summary checks
- tolerance handling
- secondary reconciliation summaries in pay run review
- optional materialized secondary exceptions where appropriate
- tests for matched, within tolerance, and mismatch cases

Out of scope:
- close-pack-first UX
- reconciliation wizard as the main workflow
- broad export overhauls
- new payroll engine logic

Constraints:
- reviewer-first workflow remains primary
- reconciliation is additive, not foundational
- do not recentre the product on totals or close packs
- keep integration generic and upload-first

Definition of done:
- journal/payment files can be uploaded and normalized
- reconciliation checks run deterministically
- mismatches are visible as secondary information
- tests cover core reconciliation behaviors

At the end, provide:
- summary of changes
- files changed
- tests added
- notes on how reviewer-first priority was preserved
```

**What to review before merging**
- Did Codex accidentally recentre the product on reconciliation?
- Does the reviewer queue remain primary?

---

## [ ] P11 — Add exports, reruns, and hardening
**Mode:** Code
**When to run:** after P10
**Goal:** make the product pilot-ready

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md
- README.md

Implement pilot-readiness hardening.

In scope:
- exception CSV export
- reconciliation summary CSV export
- sign-off PDF export
- audit export
- replacement/rerun handling for source files
- explicit lineage preservation
- large table pagination or virtualization
- async processing boundaries with Trigger.dev where needed
- improved error handling
- final README updates for local setup and developer workflow
- launch checklist updates if needed
- tests/smoke checks for critical flows

Out of scope:
- new product scope
- advanced analytics
- AI features
- broad architecture changes

Constraints:
- keep exports secondary to the review workflow
- preserve auditability
- do not compromise lineage for convenience
- keep changes practical and pilot-focused

Definition of done:
- exports work
- rerun/replacement flows are explicit
- critical reviewer workflow still works end-to-end
- performance is acceptable for realistic payroll review sizes
- docs are updated

At the end, provide:
- summary of changes
- files changed
- tests added
- launch-readiness notes
```

**What to review before merging**
- Is the first reviewer slice still intact?
- Are reruns safe?
- Are exports useful without becoming the product center?

---

# 2. Review and correction prompts

---

## R01 — Review the latest completed implementation
**Mode:** Ask
**When to run:** after every implementation prompt

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md
- README.md

Review the most recent implementation in the repo.

Do not write code yet.

Check for:
- correctness
- scope drift
- missing tests
- multi-tenant safety
- auditability gaps
- reviewer-first product alignment
- reconciliation-first drift
- missing edge cases
- weak UX relative to the intended payroll reviewer workflow

Output format:
- Critical issues
- Important issues
- Nice-to-have improvements
- Missing tests
- Merge recommendation: yes / no
```

---

## R02 — Fix issues found in review
**Mode:** Code
**When to run:** only if R01 finds issues

```text
Read these files first and treat them as the source of truth:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md
- README.md

Use the review findings below as hard input.

Fix only the issues listed below.
Do not broaden scope.
Do not add unrelated improvements.

Review findings:
[PASTE REVIEW OUTPUT HERE]

Constraints:
- stay within the original ticket scope
- preserve reviewer-first product direction
- add tests where missing
- keep the patch small and reviewable

At the end, provide:
- summary of fixes
- files changed
- tests added or updated
- whether all critical issues are resolved
```

---

## R03 — Sync the docs after a completed merge
**Mode:** Code
**When to run:** after a successful merge if docs need updating

```text
Read:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md
- README.md

Use the latest merged implementation as context.

Update docs only where needed so the repo remains truthful.
Do not change application code.

Update:
- SPRINT.md status
- roadmap.md progress notes
- DECISIONS.md if a meaningful decision was made
- README.md if local setup or scripts changed

Keep edits minimal and factual.

At the end, provide:
- files changed
- what was updated
- any unresolved doc/code mismatch that still exists
```

---

## R04 — Stop drift and re-anchor to the product
**Mode:** Ask
**When to run:** if you feel Codex is pulling the product off course

```text
Read:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Evaluate the current repo state against the intended Tally product.

Do not write code.

Specifically check for:
- reconciliation-first drift
- summary-first domain modeling
- UX drift away from the reviewer queue
- architecture drift from accepted decisions
- overbuilding
- features that are not helping a payroll reviewer compare current vs previous payroll faster and more safely than Excel

Output:
- What is aligned
- What is drifting
- What should be cut or deferred
- What the next smallest correct step is
```

---

# 3. Optional planning prompts

---

## PL01 — Plan the next smallest ticket
**Mode:** Ask
**When to run:** if you want Codex to suggest the next slice rather than following this file rigidly

```text
Read:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Inspect the current repo state.

Suggest the next smallest implementation ticket that creates real progress toward the first reviewer-first MVP.
Do not suggest anything outside current scope.

Output:
- Ticket title
- Objective
- In scope
- Out of scope
- Acceptance criteria
- Tests required
- Why this is the right next step
```

---

## PL02 — Compare implementation against the first true reviewer slice
**Mode:** Ask
**When to run:** after P09 or whenever you want to check MVP completeness

```text
Read:
- PRD.md
- ARCHITECTURE.md
- AGENTS.md
- SPRINT.md
- DECISIONS.md
- roadmap.md

Evaluate the repo against this target slice:

A signed-in reviewer can:
1. create org/client/pay run
2. upload current payroll CSV
3. upload previous payroll CSV
4. preview and map files
5. normalize into employee-level canonical records
6. match current to previous
7. generate deterministic field-level exceptions
8. triage exceptions in a dense reviewer queue
9. inspect employee drilldown with source-row evidence
10. comment/resolve and approve with gating

Do not write code.

Output:
- What is complete
- What is partial
- What is missing
- What blocks an internal pilot
```

---

# 4. Founder checklist

Use this as your operating rhythm.

## Before starting
- [ ] Fresh repo created
- [ ] `prompts.md` added to root
- [ ] P00 run and reviewed
- [ ] P01 run and reviewed

## Build sequence
- [x] P02
- [x] P03
- [ ] P04
- [ ] Add real fixtures manually
- [ ] P05
- [ ] P06
- [ ] P07
- [ ] P08
- [ ] P09
- [ ] P10
- [ ] P11

## After every implementation
- [ ] run lint
- [ ] run typecheck
- [ ] run tests
- [ ] run build
- [ ] run R01 review
- [ ] run R02 fix if needed
- [ ] commit
- [ ] merge
- [ ] run R03 docs sync if needed

---

# 5. Final rule

Whenever you are unsure whether to keep building something, ask:

**Does this help a payroll reviewer compare current vs previous payroll faster and more safely than Excel?**

If yes, it is probably in scope.
If no, it is probably drift.
