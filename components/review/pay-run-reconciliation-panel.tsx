import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PayRunReconciliationSummaryRow } from "@/lib/reconciliation/service";

type PayRunReconciliationPanelProps = {
  rows: PayRunReconciliationSummaryRow[];
};

function formatMoney(value: string | null) {
  if (!value) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-IE", {
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number.parseFloat(value));
}

function formatStateLabel(
  state: PayRunReconciliationSummaryRow["state"],
) {
  return state.replace(/_/g, " ");
}

function getStateBadgeClassName(
  state: PayRunReconciliationSummaryRow["state"],
) {
  if (state === "mismatch") {
    return "border-red-300 bg-red-50 text-red-800";
  }

  if (state === "within_tolerance") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (state === "matched") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
}

function buildNotes(row: PayRunReconciliationSummaryRow) {
  if (row.state === "missing_source") {
    return "Upload and map a source file to run this secondary check.";
  }

  if (row.state === "awaiting_normalization") {
    return "Save mappings on the latest source file to normalize it.";
  }

  if (row.state === "awaiting_payroll") {
    return "Current payroll facts must exist before this comparison can run.";
  }

  return `${row.normalizedRowCount} normalized source rows.`;
}

export function PayRunReconciliationPanel({
  rows,
}: PayRunReconciliationPanelProps) {
  return (
    <Card className="rounded-md border-border/80">
      <CardHeader>
        <CardTitle>Secondary reconciliation</CardTitle>
        <CardDescription>
          Reviewer triage stays primary. These summary checks stay close without
          turning the pay run into a close-pack workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Check</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Payroll</TableHead>
              <TableHead className="text-right">Imported</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Tolerance</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.checkKind}>
                <TableCell className="font-medium text-foreground">
                  {row.label}
                </TableCell>
                <TableCell className="text-sm">
                  {row.sourceFile ? (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {row.sourceFile.originalFilename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        v{row.sourceFile.version}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No file</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`rounded-md capitalize ${getStateBadgeClassName(row.state)}`}
                  >
                    {formatStateLabel(row.state)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.payrollAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.sourceAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.varianceAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.toleranceAmount)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {buildNotes(row)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
