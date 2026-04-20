# Pilot Launch Checklist

## Reviewer workflow

- [ ] Current and previous payroll uploads work for the target client.
- [ ] Both payroll files can be previewed and mapped.
- [ ] Reviewer processing completes for the active mapped payroll files.
- [ ] Review queue and employee drilldown load from the active reviewer snapshot.
- [ ] Missing/current-vs-previous review cases are inspectable from the queue.
- [ ] Approval is blocked by unresolved blocker exceptions.
- [ ] Approval succeeds once blocker gating is cleared.

## Reruns and lineage

- [ ] Replacing a payroll file creates a new source version.
- [ ] The pay-run processing panel reports the reviewer snapshot as stale after a replacement or mapping change.
- [ ] Reprocessing creates a fresh active snapshot instead of silently mutating prior source lineage.
- [ ] Source lineage remains visible from queue/drilldown evidence and source-file version history.

## Exports

- [ ] Exception CSV downloads from the active reviewer snapshot.
- [ ] Reconciliation summary CSV downloads for the pay run.
- [ ] Sign-off PDF downloads only after the active snapshot is approved.
- [ ] Audit JSON export includes source files, processing runs, exceptions, comments, and approval events.

## Infrastructure

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is configured in the target environment.
- [ ] Source-file bucket exists and is writable/readable for the app and worker.
- [ ] Trigger.dev is configured for async processing, or inline fallback is acceptable for the pilot environment.
- [ ] Prisma migrations are applied to the target database.

## Verification

- [ ] `npm run test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
