import { NextRequest } from "next/server";

import { getAuditExport } from "@/lib/exports/service";
import { requireAuthorizedPayRunContext } from "@/lib/pay-runs/access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payRunId: string }> },
) {
  const { payRunId } = await params;
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("orgSlug")?.trim();
  const clientId = searchParams.get("clientId")?.trim();

  if (!orgSlug || !clientId) {
    return Response.json(
      {
        error: "orgSlug and clientId are required.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const context = await requireAuthorizedPayRunContext({
      clientId,
      orgSlug,
      payRunId,
    });
    const auditExport = await getAuditExport({
      clientId: context.client.id,
      organizationId: context.organizationContext.organization.id,
      payRunId: context.payRun.id,
    });

    return new Response(JSON.stringify(auditExport, null, 2), {
      headers: {
        "content-disposition": `attachment; filename="${context.payRun.title.replace(/\s+/g, "-").toLowerCase()}-audit.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Audit export failed.",
      },
      {
        status: 403,
      },
    );
  }
}
