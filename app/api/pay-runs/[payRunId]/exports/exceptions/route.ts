import { NextRequest } from "next/server";

import { buildCsv } from "@/lib/exports/csv";
import { getExceptionExportRows } from "@/lib/exports/service";
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
    const csv = buildCsv(
      await getExceptionExportRows({
        clientId: context.client.id,
        organizationId: context.organizationContext.organization.id,
        payRunId: context.payRun.id,
        reviewSnapshotVersion: context.payRun.activeReviewSnapshotVersion,
      }),
    );

    return new Response(csv, {
      headers: {
        "content-disposition": `attachment; filename="${context.payRun.title.replace(/\s+/g, "-").toLowerCase()}-exceptions.csv"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Exception export failed.",
      },
      {
        status: 403,
      },
    );
  }
}
