# Tally Product Requirements Document

## Product Summary
Tally is a multi-tenant web app for payroll review, reconciliation, and sign-off for Ireland-first payroll bureaus and payroll-focused accounting teams, designed with UK-ready constraints from the start.

Tally v1 is an employee-level payroll review product first. Its primary job is to help reviewers compare the current payroll run to the previous payroll run, identify deterministic exceptions, inspect source evidence, collaborate on resolution, and approve a pay run with a durable audit trail.

Reconciliation and exports matter, but they are secondary workflows in v1.

## Problem Statement
Payroll reviewers often work from spreadsheet packs, email threads, and payroll-system exports that are difficult to trace and harder to approve safely. The review process is slow, fragile, and poorly auditable because:

- current and previous payroll runs are hard to compare at employee level
- field-level variances are scattered across spreadsheets or manual notes
- reviewers cannot reliably trace an exception back to the uploaded source row
- comments, approvals, and decision history are not centralized
- payroll-summary-only review misses employee-level anomalies

Tally solves this by making employee-level current-vs-previous review the default operating model.

## Product Goals
- Reduce reviewer time spent finding meaningful payroll changes.
- Make every exception traceable to normalized records and source-row evidence.
- Provide explicit approval gating and audit history for every pay run.
- Support upload-first onboarding without requiring payroll-system integrations.
- Preserve a data model that can later support reconciliation and exports without distorting the primary reviewer workflow.

## Non-Goals
Tally v1 is not:

- payroll processing software
- a gross-to-net calculator
- a tax engine
- a filing or submission product
- an HRIS
- an employee self-service portal
- a payments platform
- AI in the critical review path
- a reconciliation-first close-pack tool

## Primary Users
### Payroll Reviewer
Owns day-to-day review of current vs previous payroll changes, triages exceptions, requests clarification, and approves work when evidence is sufficient.

### Payroll Manager / Approver
Oversees pay runs, checks reviewer progress, validates that gating is satisfied, and records final approval decisions.

### Bureau Admin / Practice Lead
Manages organization setup, clients, memberships, and operational controls across multiple payroll clients.

## Core v1 Workflow
1. Create organization, memberships, roles, and client.
2. Create a pay run for a client and pay period.
3. Upload current payroll CSV or XLSX.
4. Upload previous payroll CSV or XLSX.
5. Preview each file and map source columns to canonical fields.
6. Normalize source data into employee-level canonical run records and pay components.
7. Match current-run employees to previous-run employees.
8. Run deterministic field-level variance checks.
9. Generate reviewer exceptions backed by immutable rule results.
10. Triage exceptions in a dense reviewer queue.
11. Open employee drilldown with field deltas, source-row evidence, comments, and resolution history.
12. Resolve exceptions and approve the pay run only when gating rules are satisfied.

## UX Principles
- Reviewer-first: optimize for dense operational review, not presentation dashboards.
- Auditability-first: every meaningful derived value should be explainable and traceable.
- Deterministic over clever: prefer explicit rules and transparent matching over opaque automation.
- Upload-first: users must be able to start from source files without integration work.
- Safe defaults: prevent cross-tenant leakage, premature approval, and silent data mutation.
- Evidence in context: every flagged issue should link to canonical values and source lineage.
- Boring on purpose: use familiar workflows, labels, and controls over novelty.

## v1 Scope
### In Scope
- Organizations, memberships, roles, and tenant isolation
- Clients under organizations
- Pay runs with lifecycle state
- Source file uploads, storage metadata, and lineage
- CSV/XLSX preview before import
- Mapping templates and per-file mappings
- Canonical employee run records
- Canonical employee pay components
- Source row references for traceability
- Previous-run employee matching
- Deterministic comparison rules
- Immutable rule results
- Stateful review exceptions
- Exception comments
- Approval events and gating
- Reviewer queue
- Employee drilldown
- Audit history

### Deferred, But Intentionally Supported Later
- Journal reconciliation workflow
- Payment reconciliation workflow
- CSV exports
- PDF exports

## Functional Requirements
### Tenancy and Access
- Users belong to one or more organizations through memberships.
- Data access is always scoped to organization membership and role.
- Clients and pay runs are partitioned by organization.

### Pay Run and Import
- A pay run must support separate current and previous source files.
- Users must be able to inspect a source file preview before finalizing mappings.
- Mappings must be saveable as reusable templates.
- Import processing must preserve lineage from normalized records back to source rows.

### Canonical Review Domain
- Each employee in a pay run must have a canonical record for current-run values.
- Pay components must be represented separately from high-level employee records.
- Previous-run matching must produce a stable relationship for comparisons.

### Review and Approval
- Deterministic rules must create immutable rule results.
- Review exceptions must track mutable reviewer state separately from rule results.
- Reviewers must be able to comment and resolve exceptions without mutating historical findings.
- Approval must be gated by unresolved exception status and role permissions.

## Acceptance Criteria
### Product-Level Acceptance
- The documented primary workflow is employee-level current-vs-previous payroll review.
- Reconciliation is described as a secondary later workflow, not the main UX.
- Auditability, lineage, and approval gating are explicit product requirements.
- Non-goals clearly exclude payroll calculation, tax, filing, payments, and AI-critical decisions.

### v1 Documentation Acceptance
- Every core v1 entity is named and explained consistently across repo docs.
- The docs make clear that payroll-summary-only modeling is insufficient.
- The docs give enough specificity to scaffold the repo without product-direction ambiguity.
