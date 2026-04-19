"use client";

import { type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { type ServiceStatus } from "@/lib/env";

const columns: ColumnDef<ServiceStatus>[] = [
  {
    accessorKey: "label",
    header: "Service",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;

      return (
        <Badge
          variant="outline"
          className={
            status === "configured"
              ? "rounded-md border-emerald-600/25 bg-emerald-500/10 text-emerald-800"
              : "rounded-md border-amber-600/25 bg-amber-500/10 text-amber-900"
          }
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "detail",
    header: "Detail",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.detail}</span>
    ),
  },
];

export function InfrastructureStatusTable({
  data,
}: {
  data: ServiceStatus[];
}) {
  return <DataTable columns={columns} data={data} emptyState="No services found." />;
}
