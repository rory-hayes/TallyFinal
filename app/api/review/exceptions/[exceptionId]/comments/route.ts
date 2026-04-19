import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { addReviewExceptionComment } from "@/lib/review/exceptions";
import { canManageReviewExceptions } from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
  clientId: z.string().trim().min(1),
  orgSlug: z.string().trim().min(1),
  payRunId: z.string().trim().min(1),
});

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      exceptionId: string;
    }>;
  },
) {
  const user = await requireAuthenticatedUser();
  const parsed = createCommentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      {
        error: "Exception comment payload was invalid.",
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
        error: "Your role cannot comment on review exceptions.",
      },
      {
        status: 403,
      },
    );
  }

  const { exceptionId } = await context.params;
  const comment = await addReviewExceptionComment({
    authorUserId: user.id,
    body: parsed.data.body,
    clientId: parsed.data.clientId,
    organizationId: organizationContext.organization.id,
    payRunId: parsed.data.payRunId,
    reviewExceptionId: exceptionId,
  });

  return Response.json({
    comment,
    ok: true,
  });
}
