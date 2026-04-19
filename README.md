# Tally

Tally is a multi-tenant web app for payroll review, reconciliation, and sign-off for Ireland-first payroll bureaus and payroll-focused accounting teams, with UK-ready design constraints.

The product is reviewer-first. In v1, the main workflow is employee-level current-vs-previous payroll review with deterministic exceptions, source-row evidence, comments, and approval gating.

## Repo Status
This repository now contains the app baseline for a single full-stack Next.js project. The current slice is intentionally generic: it proves the stack, the UI primitives, and the shared infrastructure scaffolds without introducing payroll workflow features early.

## Core Docs
- [prompts.md](/Users/rory/TallyFinal/prompts.md)
- [PRD.md](/Users/rory/TallyFinal/PRD.md)
- [ARCHITECTURE.md](/Users/rory/TallyFinal/ARCHITECTURE.md)
- [AGENTS.md](/Users/rory/TallyFinal/AGENTS.md)
- [SPRINT.md](/Users/rory/TallyFinal/SPRINT.md)
- [DECISIONS.md](/Users/rory/TallyFinal/DECISIONS.md)
- [roadmap.md](/Users/rory/TallyFinal/roadmap.md)

## Planned Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Table
- Supabase for auth, Postgres, and storage
- Prisma for schema and migrations
- Trigger.dev for async jobs
- Vercel for hosting

## Local Setup
1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file and fill in the values you have:

   ```bash
   cp .env.example .env.local
   ```

3. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

The authenticated shell placeholder lives at `/app`. The health endpoint lives at `/api/health`.

## Available Scripts
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

## Current Baseline Includes
- root docs as the product source of truth
- Next.js App Router project at the repo root
- Tailwind CSS v4
- shadcn/ui setup and shared UI primitives
- TanStack Table wrapper for dense operational tables
- Supabase browser/server helpers
- Prisma schema and client wiring
- Trigger.dev config and a simple scaffold task
- environment example file
- authenticated app shell placeholder
- health page and health API

## Manual Inputs Still Needed
Before deeper payroll logic work starts:
- add at least 2 anonymized current/previous Irish payroll CSV pairs under `fixtures/payroll/`
- add at least 1 messy sample with awkward headers or formatting
- review docs before implementation starts
- review each merge manually

## Working Rules
- work from a fresh repo baseline
- run one implementation prompt at a time
- review, test, and commit after each completed implementation prompt
- stop and fix docs first if docs and code diverge
