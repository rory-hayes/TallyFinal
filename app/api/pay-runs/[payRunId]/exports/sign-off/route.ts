import { NextRequest } from "next/server";

import { buildSignOffPdf } from "@/lib/exports/pdf";
import { getSignOffExportData } from "@/lib/exports/service";
import { requireAuthorizedPayRunContext } from "@/lib/pay-runs/access";

function pickLatestProcessedSources(sourceFiles: {
  kind: string;
  originalFilename: string;
  status: string;
  version: number;
}[]) {
  const latestByKind = new Map<string, (typeof sourceFiles)[number]>();

  sourceFiles.forEach((sourceFile) => {
    if (
      sourceFile.status === "uploaded" &&
      !latestByKind.has(sourceFile.kind) &&
      (sourceFile.kind === "current_payroll" || sourceFile.kind === "previous_payroll")
    ) {
      latestByKind.set(sourceFile.kind, sourceFile);
    }
  });

  return Array.from(latestByKind.values());
}

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
    const { approvalSummary, clientName, organizationName, payRun } =
      await getSignOffExportData({
        clientId: context.client.id,
        organizationId: context.organizationContext.organization.id,
        payRunId: context.payRun.id,
      });

    if (approvalSummary.currentState !== "approved") {
      return Response.json(
        {
          error:
            "Sign-off PDF export is only available after the active reviewer snapshot is approved.",
        },
        {
          status: 409,
        },
      );
    }

    const pdfBytes = await buildSignOffPdf({
      approvalEvents: approvalSummary.events.filter(
        (event) => event.reviewSnapshotVersion === payRun.activeReviewSnapshotVersion,
      ),
      clientName,
      exceptionSummary: {
        activeExceptionCount: approvalSummary.activeExceptionCount,
        blockingExceptionCount: approvalSummary.blockingExceptionCount,
      },
      organizationName,
      payRunTitle: payRun.title,
      processedSources: pickLatestProcessedSources(payRun.sourceFiles).map((sourceFile) => ({
        filename: sourceFile.originalFilename,
        kind: sourceFile.kind,
        version: sourceFile.version,
      })),
      reviewSnapshotVersion: payRun.activeReviewSnapshotVersion,
    });

    const pdfBody = Uint8Array.from(pdfBytes).buffer;

    return new Response(pdfBody, {
      headers: {
        "content-disposition": `attachment; filename="${payRun.title.replace(/\s+/g, "-").toLowerCase()}-sign-off.pdf"`,
        "content-type": "application/pdf",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Sign-off export failed.",
      },
      {
        status: 403,
      },
    );
  }
}
