"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  persistSourceFilePreview,
  saveSourceFileMappings,
} from "@/lib/imports/service";
import {
  confirmSourceFileUpload,
  createPayRunForClient,
  findPayRunForClient,
  registerSourceFileForPayRun,
} from "@/lib/pay-runs/service";
import { SOURCE_FILE_KINDS } from "@/lib/pay-runs/source-files";
import { normalizeAndPersistReconciliationSourceFile } from "@/lib/reconciliation/service";
import { recordPayRunApprovalEvent } from "@/lib/review/approval";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findClientForOrganization } from "@/lib/clients/service";
import { readSourceFilesBucket } from "@/lib/env";
import {
  canManageApprovalActions,
  canManagePayRuns,
} from "@/lib/tenancy/access";
import { findOrganizationContextForUser } from "@/lib/tenancy/service";

const payRunSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    payDate: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value : undefined),
      z.coerce.date().optional(),
    ),
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: "Pay run dates are invalid.",
    path: ["periodEnd"],
  });

const sourceFileRegistrationSchema = z.object({
  kind: z.enum(SOURCE_FILE_KINDS),
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  byteSize: z.coerce.number().int().positive().max(500_000_000),
  checksumSha256: z.string().trim().min(32).max(128),
});

const approvalActionSchema = z.object({
  action: z.enum(["approve", "reject", "reopen", "submit"]),
  note: z.preprocess(
    (value) => (typeof value === "string" ? value : undefined),
    z.string().trim().max(2_000).optional(),
  ),
});

async function requirePayRunContext(
  orgSlug: string,
  clientId: string,
  payRunId: string,
) {
  const user = await requireAuthenticatedUser();
  const organizationContext = await findOrganizationContextForUser(
    user.id,
    orgSlug,
  );

  if (!organizationContext) {
    return {
      error: "Organization access denied.",
      ok: false as const,
    };
  }

  const client = await findClientForOrganization({
    organizationId: organizationContext.organization.id,
    clientId,
  });

  if (!client) {
    return {
      error: "Client access denied.",
      ok: false as const,
    };
  }

  const payRun = await findPayRunForClient({
    organizationId: organizationContext.organization.id,
    clientId: client.id,
    payRunId,
  });

  if (!payRun) {
    return {
      error: "Pay run access denied.",
      ok: false as const,
    };
  }

  return {
    client,
    ok: true as const,
    organizationContext,
    payRun,
    user,
  };
}

async function requireMutablePayRunContext(
  orgSlug: string,
  clientId: string,
  payRunId?: string,
) {
  if (payRunId) {
    const context = await requirePayRunContext(orgSlug, clientId, payRunId);

    if (!context.ok) {
      return context;
    }

    if (!canManagePayRuns(context.organizationContext.role)) {
      return {
        error: "Your role cannot change pay runs.",
        ok: false as const,
      };
    }

    return context;
  }

  const user = await requireAuthenticatedUser();
  const organizationContext = await findOrganizationContextForUser(
    user.id,
    orgSlug,
  );

  if (!organizationContext) {
    return {
      error: "Organization access denied.",
      ok: false as const,
    };
  }

  if (!canManagePayRuns(organizationContext.role)) {
    return {
      error: "Your role cannot change pay runs.",
      ok: false as const,
    };
  }

  const client = await findClientForOrganization({
    organizationId: organizationContext.organization.id,
    clientId,
  });

  if (!client) {
    return {
      error: "Client access denied.",
      ok: false as const,
    };
  }

  return {
    client,
    ok: true as const,
    organizationContext,
    user,
  };
}

export async function createPayRunAction(
  orgSlug: string,
  clientId: string,
  formData: FormData,
) {
  const context = await requireMutablePayRunContext(orgSlug, clientId);

  if (!context.ok) {
    return {
      error: context.error,
      ok: false as const,
    };
  }

  const parsed = payRunSchema.safeParse({
    title: formData.get("title"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    payDate: formData.get("payDate"),
  });

  if (!parsed.success) {
    return {
      error: "Check the pay run details before saving.",
      ok: false as const,
    };
  }

  const payRun = await createPayRunForClient({
    organizationId: context.organizationContext.organization.id,
    clientId: context.client.id,
    createdByUserId: context.user.id,
    title: parsed.data.title,
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    payDate: parsed.data.payDate,
  });

  revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}`);
  revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs`);

  return {
    ok: true as const,
    payRunId: payRun.id,
  };
}

export async function registerSourceFileUploadAction(
  orgSlug: string,
  clientId: string,
  payRunId: string,
  formData: FormData,
) {
  const context = await requireMutablePayRunContext(orgSlug, clientId, payRunId);

  if (!context.ok) {
    return {
      error: context.error,
      ok: false as const,
    };
  }

  if (!("payRun" in context)) {
    return {
      error: "Pay run access denied.",
      ok: false as const,
    };
  }

  const payRun = context.payRun;

  const parsed = sourceFileRegistrationSchema.safeParse({
    kind: formData.get("kind"),
    originalFilename: formData.get("originalFilename"),
    contentType: formData.get("contentType"),
    byteSize: formData.get("byteSize"),
    checksumSha256: formData.get("checksumSha256"),
  });

  if (!parsed.success) {
    return {
      error: "Source file metadata was incomplete.",
      ok: false as const,
    };
  }

  try {
    const storageBucket = readSourceFilesBucket();
    const sourceFile = await registerSourceFileForPayRun({
      organizationId: context.organizationContext.organization.id,
      clientId: context.client.id,
      payRunId: payRun.id,
      uploadedByUserId: context.user.id,
      kind: parsed.data.kind,
      originalFilename: parsed.data.originalFilename,
      contentType: parsed.data.contentType,
      byteSize: parsed.data.byteSize,
      checksumSha256: parsed.data.checksumSha256,
      storageBucket,
    });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from(storageBucket)
      .createSignedUploadUrl(sourceFile.storagePath);

    if (error || !data) {
      return {
        error: "Storage could not create an upload URL for this file.",
        ok: false as const,
      };
    }

    return {
      bucket: storageBucket,
      ok: true as const,
      path: data.path,
      sourceFileId: sourceFile.id,
      token: data.token,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Source file registration failed.",
      ok: false as const,
    };
  }
}

export async function confirmSourceFileUploadAction(
  orgSlug: string,
  clientId: string,
  payRunId: string,
  formData: FormData,
) {
  const context = await requireMutablePayRunContext(orgSlug, clientId, payRunId);

  if (!context.ok) {
    return {
      error: context.error,
      ok: false as const,
    };
  }

  if (!("payRun" in context)) {
    return {
      error: "Pay run access denied.",
      ok: false as const,
    };
  }

  const payRun = context.payRun;
  const sourceFileId = formData.get("sourceFileId");
  const file = formData.get("file");

  if (typeof sourceFileId !== "string" || !sourceFileId.trim()) {
    return {
      error: "Source file confirmation is missing the uploaded file reference.",
      ok: false as const,
    };
  }

  if (!(file instanceof File) || !file.size) {
    return {
      error: "Source file confirmation is missing the uploaded file contents.",
      ok: false as const,
    };
  }

  try {
    await confirmSourceFileUpload({
      organizationId: context.organizationContext.organization.id,
      payRunId: payRun.id,
      sourceFileId: sourceFileId.trim(),
    });

    const previewResult = await persistSourceFilePreview({
      file,
      organizationId: context.organizationContext.organization.id,
      sourceFileId: sourceFileId.trim(),
    });

    revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}`);
    revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs`);
    revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs/${payRunId}`);

    return {
      notice: previewResult.ok
        ? "Source file uploaded. Preview and mapping are ready."
        : `Source file uploaded, but preview parsing failed: ${previewResult.error}`,
      ok: true as const,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Source file confirmation failed.",
      ok: false as const,
    };
  }
}

export async function saveSourceFileMappingAction(
  orgSlug: string,
  clientId: string,
  payRunId: string,
  sourceFileId: string,
  formData: FormData,
) {
  const context = await requireMutablePayRunContext(orgSlug, clientId, payRunId);

  if (!context.ok) {
    return {
      error: context.error,
      ok: false as const,
    };
  }

  if (!("payRun" in context)) {
    return {
      error: "Pay run access denied.",
      ok: false as const,
    };
  }

  const importProfileKey = formData.get("importProfileKey");

  if (typeof importProfileKey !== "string" || !importProfileKey.trim()) {
    return {
      error: "Choose an import profile before saving mappings.",
      ok: false as const,
    };
  }

  const values = Object.fromEntries(
    Array.from(formData.entries())
      .filter(([key]) => key.startsWith("mapping:"))
      .map(([key, value]) => [
        key.replace(/^mapping:/, ""),
        typeof value === "string" ? value : "",
      ]),
  );

  const result = await saveSourceFileMappings({
    clientId: context.client.id,
    importProfileKey: importProfileKey.trim(),
    organizationId: context.organizationContext.organization.id,
    saveTemplate: formData.get("saveTemplate") === "on",
    sourceFileId,
    userId: context.user.id,
    values,
  });

  if (!result.ok) {
    return {
      error:
        "missingFields" in result && result.missingFields?.length
          ? `Required fields still need mappings: ${result.missingFields.join(", ")}.`
          : result.error ?? "Mapping could not be saved.",
      ok: false as const,
    };
  }

  revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}`);
  revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs`);
  revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs/${payRunId}`);

  const mappingNotice = result.templateSaved
    ? "Mapping saved and template updated for future uploads."
    : "Mapping saved for this upload.";
  const sourceFile = context.payRun.sourceFiles.find(
    (candidate) => candidate.id === sourceFileId,
  );

  if (sourceFile?.kind === "journal" || sourceFile?.kind === "payment") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from(sourceFile.storageBucket)
      .download(sourceFile.storagePath);

    if (error || !data) {
      return {
        notice: `${mappingNotice} Secondary reconciliation could not download the source file for normalization yet.`,
        ok: true as const,
      };
    }

    const csvText = new TextDecoder().decode(await data.arrayBuffer());
    const reconciliationResult = await normalizeAndPersistReconciliationSourceFile({
      clientId: context.client.id,
      csvText,
      mapping: values,
      organizationId: context.organizationContext.organization.id,
      payRunId: context.payRun.id,
      sourceFileId,
      sourceKind: sourceFile.kind,
    });

    if (!reconciliationResult.ok) {
      const firstError = reconciliationResult.errors[0];
      const errorMessage = firstError
        ? `${firstError.message}${firstError.rowNumber ? ` (row ${firstError.rowNumber})` : ""}`
        : "Secondary reconciliation normalization failed.";

      return {
        notice: `${mappingNotice} ${errorMessage}`,
        ok: true as const,
      };
    }

    return {
      notice: `${mappingNotice} ${reconciliationResult.normalizedRowCount} ${sourceFile.kind} rows normalized and secondary reconciliation refreshed.`,
      ok: true as const,
    };
  }

  return {
    notice: mappingNotice,
    ok: true as const,
  };
}

export async function recordPayRunApprovalEventAction(
  orgSlug: string,
  clientId: string,
  payRunId: string,
  formData: FormData,
) {
  const context = await requirePayRunContext(orgSlug, clientId, payRunId);

  if (!context.ok) {
    return {
      error: context.error,
      ok: false as const,
    };
  }

  if (!canManageApprovalActions(context.organizationContext.role)) {
    return {
      error: "Your role cannot submit or approve pay runs.",
      ok: false as const,
    };
  }

  const parsed = approvalActionSchema.safeParse({
    action: formData.get("action"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      error: "Approval workflow input was invalid.",
      ok: false as const,
    };
  }

  try {
    await recordPayRunApprovalEvent({
      action: parsed.data.action,
      actorRole: context.organizationContext.role,
      actorUserId: context.user.id,
      clientId: context.client.id,
      note: parsed.data.note,
      organizationId: context.organizationContext.organization.id,
      payRunId: context.payRun.id,
    });

    revalidatePath(`/app/orgs/${orgSlug}/clients/${clientId}/pay-runs/${payRunId}`);

    return {
      notice:
        parsed.data.action === "submit"
          ? "Pay run submitted for approval."
          : parsed.data.action === "approve"
            ? "Pay run approved."
            : parsed.data.action === "reject"
              ? "Pay run rejected back to review."
              : "Pay run reopened for review.",
      ok: true as const,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Approval workflow update failed.",
      ok: false as const,
    };
  }
}
