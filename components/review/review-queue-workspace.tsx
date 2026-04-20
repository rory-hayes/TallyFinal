"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildReviewQueueSummary,
  formatReviewStatusLabel,
  formatRuleCodeLabel,
  getReviewQueueRuleTypeOptions,
  matchesReviewQueueStatusFilter,
  summarizeRuleDetails,
  type ReviewQueueStatusFilter,
} from "@/lib/review/queue";
import type { ReviewExceptionListItem } from "@/lib/review/exceptions";

type ReviewQueueAssignee = {
  displayName: string | null;
  email: string | null;
  role: string;
  userId: string;
};

type ReviewQueueWorkspaceProps = {
  assignees: ReviewQueueAssignee[];
  clientId: string;
  exceptions: ReviewExceptionListItem[];
  orgSlug: string;
  payRunId: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-IE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const severityRank = {
  blocker: 0,
  warning: 1,
  info: 2,
} as const;

const statusRank = {
  open: 0,
  in_review: 1,
  resolved: 2,
  dismissed: 3,
} as const;

function getSeverityBadgeClassName(
  severity: "blocker" | "info" | "warning",
) {
  if (severity === "blocker") {
    return "border-red-300 bg-red-50 text-red-800";
  }

  if (severity === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  return "border-sky-300 bg-sky-50 text-sky-800";
}

function getStatusBadgeClassName(status: string) {
  if (status === "resolved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (status === "dismissed") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (status === "in_review") {
    return "border-blue-300 bg-blue-50 text-blue-800";
  }

  return "border-violet-300 bg-violet-50 text-violet-800";
}

function getAssigneeLabel(
  assigneeUserId: string | null,
  assignees: ReviewQueueAssignee[],
) {
  if (!assigneeUserId) {
    return "Unassigned";
  }

  const assignee = assignees.find((candidate) => candidate.userId === assigneeUserId);

  if (!assignee) {
    return assigneeUserId;
  }

  return assignee.displayName || assignee.email || assignee.userId;
}

function getEmployeeSearchText(exception: ReviewExceptionListItem) {
  return [
    exception.ruleResult.employeeRunRecord.employeeDisplayName,
    exception.ruleResult.employeeRunRecord.employeeExternalId,
    exception.ruleResult.employeeRunRecord.employeeNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasActiveFilters(filters: {
  employee: string;
  ruleCode: string;
  severity: string;
  status: ReviewQueueStatusFilter;
}) {
  return (
    filters.employee.trim().length > 0 ||
    filters.ruleCode !== "all" ||
    filters.severity !== "all" ||
    filters.status !== "active"
  );
}

export function ReviewQueueWorkspace({
  assignees,
  clientId,
  exceptions,
  orgSlug,
  payRunId,
}: ReviewQueueWorkspaceProps) {
  const router = useRouter();
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [ruleCodeFilter, setRuleCodeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] =
    useState<ReviewQueueStatusFilter>("active");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([
    {
      desc: false,
      id: "severity",
    },
    {
      desc: false,
      id: "status",
    },
    {
      desc: true,
      id: "updatedAt",
    },
  ]);
  const [selectedAssigneeUserId, setSelectedAssigneeUserId] = useState(
    assignees[0]?.userId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const summary = useMemo(() => buildReviewQueueSummary(exceptions), [exceptions]);
  const ruleTypeOptions = useMemo(
    () => getReviewQueueRuleTypeOptions(exceptions),
    [exceptions],
  );

  const filteredExceptions = useMemo(() => {
    return exceptions
      .filter((exception) =>
        matchesReviewQueueStatusFilter(exception.reviewStatus, statusFilter),
      )
      .filter((exception) =>
        severityFilter === "all"
          ? true
          : exception.ruleResult.severity === severityFilter,
      )
      .filter((exception) =>
        ruleCodeFilter === "all"
          ? true
          : exception.ruleResult.ruleCode === ruleCodeFilter,
      )
      .filter((exception) =>
        employeeFilter.trim()
          ? getEmployeeSearchText(exception).includes(
              employeeFilter.trim().toLowerCase(),
            )
          : true,
      );
  }, [employeeFilter, exceptions, ruleCodeFilter, severityFilter, statusFilter]);

  const columns = useMemo<ColumnDef<ReviewExceptionListItem>[]>(
    () => [
      {
        cell: ({ row }) => (
          <input
            aria-label={`Select ${row.original.ruleResult.employeeRunRecord.employeeDisplayName}`}
            checked={row.getIsSelected()}
            className="h-4 w-4 rounded border border-input"
            onChange={row.getToggleSelectedHandler()}
            type="checkbox"
          />
        ),
        enableSorting: false,
        header: ({ table }) => (
          <input
            aria-label="Select all visible exceptions"
            checked={table.getIsAllPageRowsSelected()}
            className="h-4 w-4 rounded border border-input"
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            type="checkbox"
          />
        ),
        id: "select",
        meta: {
          className: "w-11",
        },
      },
      {
        accessorFn: (exception) => exception.ruleResult.severity,
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`rounded-md capitalize ${getSeverityBadgeClassName(row.original.ruleResult.severity)}`}
          >
            {row.original.ruleResult.severity}
          </Badge>
        ),
        header: "Severity",
        id: "severity",
        sortingFn: (left, right) =>
          severityRank[left.original.ruleResult.severity] -
          severityRank[right.original.ruleResult.severity],
      },
      {
        accessorFn: (exception) => exception.reviewStatus,
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`rounded-md ${getStatusBadgeClassName(row.original.reviewStatus)}`}
          >
            {formatReviewStatusLabel(row.original.reviewStatus)}
          </Badge>
        ),
        header: "Status",
        id: "status",
        sortingFn: (left, right) =>
          statusRank[left.original.reviewStatus] -
          statusRank[right.original.reviewStatus],
      },
      {
        cell: ({ row }) => {
          const record = row.original.ruleResult.employeeRunRecord;

          return (
            <div className="space-y-1">
              <Link
                href={`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs/${payRunId}/employees/${record.id}`}
                className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                {record.employeeDisplayName}
              </Link>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {record.employeeNumber ? (
                  <span>Payroll #{record.employeeNumber}</span>
                ) : null}
                {record.employeeExternalId ? (
                  <span>ID {record.employeeExternalId}</span>
                ) : null}
                {row.original.ruleResult.employeeMatch?.matchMethod ? (
                  <span>
                    Match {row.original.ruleResult.employeeMatch.matchMethod.replace(
                      /_/g,
                      " ",
                    )}
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
        header: "Employee",
        id: "employee",
      },
      {
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {formatRuleCodeLabel(row.original.ruleResult.ruleCode)}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {row.original.ruleResult.ruleMessage}
            </p>
          </div>
        ),
        header: "Rule type",
        id: "ruleType",
      },
      {
        cell: ({ row }) => {
          const sourceRowRefs = row.original.ruleResult.employeeRunRecord.sourceRowRefs;

          return (
            <div className="space-y-1">
              <p className="text-sm leading-5 text-foreground">
                {summarizeRuleDetails(row.original.ruleResult.details)}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{sourceRowRefs.length} lineage refs</span>
                {sourceRowRefs[0]?.rowNumber ? (
                  <span>First source row {sourceRowRefs[0].rowNumber}</span>
                ) : null}
              </div>
            </div>
          );
        },
        header: "Evidence",
        id: "evidence",
      },
      {
        accessorFn: (exception) => exception.assigneeUserId ?? "",
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              {getAssigneeLabel(row.original.assigneeUserId, assignees)}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.comments.length
                ? `${row.original.comments.length} notes`
                : "No review notes"}
            </p>
          </div>
        ),
        header: "Owner",
        id: "assignee",
      },
      {
        accessorFn: (exception) => exception.updatedAt.toISOString(),
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              {dateTimeFormatter.format(row.original.updatedAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              Created {dateTimeFormatter.format(row.original.createdAt)}
            </p>
          </div>
        ),
        header: "Updated",
        id: "updatedAt",
      },
      {
        cell: ({ row }) => (
          <Button asChild size="sm" variant="outline" className="rounded-md">
            <Link
              href={`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs/${payRunId}/employees/${row.original.ruleResult.employeeRunRecord.id}`}
            >
              Open
            </Link>
          </Button>
        ),
        enableSorting: false,
        header: "",
        id: "actions",
      },
    ],
    [assignees, clientId, orgSlug, payRunId],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: filteredExceptions,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      rowSelection,
      sorting,
    },
  });

  const selectedExceptionIds = table
    .getSelectedRowModel()
    .rows.map((row) => row.original.id);

  async function runBulkAction(input: {
    action: "assign" | "ignore" | "resolve";
    assigneeUserId?: string;
  }) {
    if (!selectedExceptionIds.length) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsMutating(true);

    try {
      const response = await fetch("/api/review/exceptions", {
        body: JSON.stringify({
          action: input.action,
          assigneeUserId: input.assigneeUserId,
          clientId,
          exceptionIds: selectedExceptionIds,
          orgSlug,
          payRunId,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      });
      const result = (await response.json()) as
        | {
            error: string;
          }
        | {
            ok: true;
            skippedExceptionIds: string[];
            updatedExceptionCount: number;
          };

      if (!response.ok || !("ok" in result)) {
        setError(
          "error" in result ? result.error : "The review queue update failed.",
        );
        return;
      }

      setRowSelection({});
      setNotice(
        input.action === "assign"
          ? `Assigned ${result.updatedExceptionCount} exception${result.updatedExceptionCount === 1 ? "" : "s"}.`
          : `${input.action === "resolve" ? "Resolved" : "Ignored"} ${result.updatedExceptionCount} exception${result.updatedExceptionCount === 1 ? "" : "s"}.`,
      );
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The review queue update failed.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-border/80 bg-background">
        <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-5">
          <div className="border-b border-border/80 px-4 py-3 xl:border-b-0 xl:border-r">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Needs attention
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {summary.activeCount}
            </p>
          </div>
          <div className="border-b border-border/80 px-4 py-3 sm:border-l-0 xl:border-b-0 xl:border-r">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Blockers
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {summary.severityCounts.blocker}
            </p>
          </div>
          <div className="border-b border-border/80 px-4 py-3 xl:border-b-0 xl:border-r">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Warnings
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {summary.severityCounts.warning}
            </p>
          </div>
          <div className="border-b border-border/80 px-4 py-3 sm:border-l-0 xl:border-b-0 xl:border-r">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Resolved
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {summary.resolvedCount}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Ignored
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {summary.dismissedCount}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border/80 bg-background p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Reviewer queue
            </h2>
            <p className="text-sm text-muted-foreground">
              Defaulted to active exceptions so the first screen is what needs
              attention now.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {filteredExceptions.length} of {summary.totalCount} exceptions
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Severity</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onChange={(event) => setSeverityFilter(event.target.value)}
              value={severityFilter}
            >
              <option value="all">All severities</option>
              <option value="blocker">Blocker</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Status</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onChange={(event) =>
                setStatusFilter(event.target.value as ReviewQueueStatusFilter)
              }
              value={statusFilter}
            >
              <option value="active">Needs attention</option>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Ignored</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Employee</span>
            <Input
              onChange={(event) => setEmployeeFilter(event.target.value)}
              placeholder="Name, payroll number, or external id"
              value={employeeFilter}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Rule type</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onChange={(event) => setRuleCodeFilter(event.target.value)}
              value={ruleCodeFilter}
            >
              <option value="all">All rule types</option>
              {ruleTypeOptions.map((ruleType) => (
                <option key={ruleType.value} value={ruleType.value}>
                  {ruleType.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasActiveFilters({
          employee: employeeFilter,
          ruleCode: ruleCodeFilter,
          severity: severityFilter,
          status: statusFilter,
        }) ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Filters are narrowing the queue.</span>
            <Button
              className="rounded-md"
              onClick={() => {
                setEmployeeFilter("");
                setRuleCodeFilter("all");
                setSeverityFilter("all");
                setStatusFilter("active");
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Reset filters
            </Button>
          </div>
        ) : null}

        {selectedExceptionIds.length ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/80 bg-muted/20 px-3 py-2">
            <p className="text-sm font-medium text-foreground">
              {selectedExceptionIds.length} selected
            </p>
            <Button
              className="rounded-md"
              disabled={isMutating}
              onClick={() => void runBulkAction({ action: "resolve" })}
              size="sm"
              type="button"
            >
              Resolve
            </Button>
            <Button
              className="rounded-md"
              disabled={isMutating}
              onClick={() => void runBulkAction({ action: "ignore" })}
              size="sm"
              type="button"
              variant="outline"
            >
              Ignore
            </Button>
            {assignees.length ? (
              <>
                <select
                  className="flex h-9 min-w-56 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onChange={(event) => setSelectedAssigneeUserId(event.target.value)}
                  value={selectedAssigneeUserId}
                >
                  {assignees.map((assignee) => (
                    <option key={assignee.userId} value={assignee.userId}>
                      {(assignee.displayName || assignee.email || assignee.userId) +
                        ` (${assignee.role})`}
                    </option>
                  ))}
                </select>
                <Button
                  className="rounded-md"
                  disabled={isMutating || !selectedAssigneeUserId}
                  onClick={() =>
                    void runBulkAction({
                      action: "assign",
                      assigneeUserId: selectedAssigneeUserId,
                    })
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Assign
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="overflow-hidden rounded-md border border-border/80">
          <Table>
            <TableHeader className="bg-muted/30">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={header.column.id === "actions" ? "text-right" : undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="align-top data-[state=selected]:bg-muted/40"
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          cell.column.id === "actions"
                            ? "text-right"
                            : cell.column.id === "employee" ||
                                cell.column.id === "ruleType" ||
                                cell.column.id === "evidence" ||
                                cell.column.id === "assignee"
                              ? "whitespace-normal"
                              : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        No exceptions match the current queue filters.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {summary.totalCount
                          ? "Try widening severity, status, employee, or rule type."
                          : "This pay run has no materialized review exceptions yet."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
