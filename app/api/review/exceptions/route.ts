import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { findClientForOrganization } from "@/lib/clients/service";
import { findPayRunForClient } from "@/lib/pay-runs/service";
import {
  bulkAssignReviewExceptions,
  bulkSetReviewExceptionStatus,
  listReviewExceptions,
} from "@/lib/review/exceptions";
import { canManageReviewExceptions } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";

const bulkStatusUpdateSchema = z.object({
  action: z.enum(["ignore", "resolve"]),
  clientId: z.string().trim().min(1),
  exceptionIds: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().max(1_000).optional(),
  orgSlug: z.string().trim().min(1),
  payRunId: z.string().trim().min(1),
});

const bulkAssignmentSchema = z.object({
  action: z.literal("assign"),
  assigneeUserId: z.string().trim().min(1),
  clientId: z.string().trim().min(1),
  exceptionIds: z.array(z.string().trim().min(1)).min(1),
  orgSlug: z.string().trim().min(1),
  payRunId: z.string().trim().min(1),
});

const severitySchema = z.enum(["blocker", "info", "warning"]);
const statusSchema = z.enum(["dismissed", "in_review", "open", "resolved"]);

export async function GET(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("orgSlug")?.trim();
  const clientId = searchParams.get("clientId")?.trim();
  const payRunId = searchParams.get("payRunId")?.trim();
  const severityValue = searchParams.get("severity")?.trim();
  const statusValue = searchParams.get("status")?.trim();

  if (!orgSlug || !clientId || !payRunId) {
    return Response.json(
      {
        error: "orgSlug, clientId, and payRunId are required.",
      },
      {
        status: 400,
      },
    );
  }

  const organizationContext = await findOrganizationContextForUser(user.id, orgSlug);

  if (!organizationContext) {
    return Response.json(
      {
        error: "Organization access denied.",
      },
      {
        status: 403,
      },
    );
  }

  const client = await findClientForOrganization({
    organizationId: organizationContext.organization.id,
    clientId,
  });

  if (!client) {
    return Response.json(
      {
        error: "Client access denied.",
      },
      {
        status: 403,
      },
    );
  }

  const payRun = await findPayRunForClient({
    organizationId: organizationContext.organization.id,
    clientId: client.id,
    payRunId,
  });

  if (!payRun) {
    return Response.json(
      {
        error: "Pay run access denied.",
      },
      {
        status: 403,
      },
    );
  }

  const exceptions = await listReviewExceptions({
    clientId: client.id,
    employee: searchParams.get("employee")?.trim() || undefined,
    organizationId: organizationContext.organization.id,
    payRunId: payRun.id,
    reviewSnapshotVersion: payRun.activeReviewSnapshotVersion,
    ruleCode: searchParams.get("ruleCode")?.trim() || undefined,
    severity: severityValue
      ? severitySchema.safeParse(severityValue).data
      : undefined,
    status: statusValue ? statusSchema.safeParse(statusValue).data : undefined,
  });

  return Response.json({
    items: exceptions,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  const body = await request.json();
  const parsed = z
    .discriminatedUnion("action", [bulkStatusUpdateSchema, bulkAssignmentSchema])
    .safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Bulk exception update payload was invalid.",
      },
      {
        status: 400,
      },
    );
  }

  const organizationContext = await findOrganizationContextForUser(
    user.id,
    parsed.data.orgSlug,
  );

  if (!organizationContext) {
    return Response.json(
      {
        error: "Organization access denied.",
      },
      {
        status: 403,
      },
    );
  }

  if (!canManageReviewExceptions(organizationContext.role)) {
    return Response.json(
      {
        error: "Your role cannot change review exceptions.",
      },
      {
        status: 403,
      },
    );
  }

  const result =
    parsed.data.action === "assign"
      ? await bulkAssignReviewExceptions({
          actorUserId: user.id,
          assigneeUserId: parsed.data.assigneeUserId,
          clientId: parsed.data.clientId,
          exceptionIds: parsed.data.exceptionIds,
          organizationId: organizationContext.organization.id,
          payRunId: parsed.data.payRunId,
        })
      : await bulkSetReviewExceptionStatus({
          action: parsed.data.action,
          actorUserId: user.id,
          clientId: parsed.data.clientId,
          exceptionIds: parsed.data.exceptionIds,
          note: parsed.data.note,
          organizationId: organizationContext.organization.id,
          payRunId: parsed.data.payRunId,
        });

  return Response.json({
    ok: true,
    ...result,
  });
}
