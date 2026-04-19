"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  SOURCE_FILE_KINDS,
  formatSourceFileKindLabel,
  type SourceFileKind,
} from "@/lib/pay-runs/source-files";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type UploadRegistrationResult =
  | {
      ok: true;
      bucket: string;
      path: string;
      sourceFileId: string;
      token: string;
    }
  | {
      error: string;
      ok: false;
    };

type UploadConfirmationResult =
  | {
      notice?: string;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

type SourceFileUploadFormProps = {
  registerUpload: (formData: FormData) => Promise<UploadRegistrationResult>;
  confirmUpload: (formData: FormData) => Promise<UploadConfirmationResult>;
};

async function computeSha256(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function SourceFileUploadForm({
  registerUpload,
  confirmUpload,
}: SourceFileUploadFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      setError("Choose a source file to upload.");
      return;
    }

    setIsSubmitting(true);

    try {
      formData.set("originalFilename", file.name);
      formData.set("contentType", file.type || "application/octet-stream");
      formData.set("byteSize", String(file.size));
      formData.set("checksumSha256", await computeSha256(file));

      const registration = await registerUpload(formData);

      if (!registration.ok) {
        setError(registration.error);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(registration.bucket)
        .uploadToSignedUrl(registration.path, registration.token, file, {
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        setError(
          "The file was registered, but the upload to storage failed. You can retry with a new version.",
        );
        return;
      }

      const confirmationFormData = new FormData();
      confirmationFormData.set("sourceFileId", registration.sourceFileId);
      confirmationFormData.set("file", file);

      const confirmation = await confirmUpload(confirmationFormData);

      if (!confirmation.ok) {
        setError(confirmation.error);
        return;
      }

      formRef.current?.reset();
      setNotice(
        confirmation.notice ?? "Source file uploaded and linked to the pay run.",
      );
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Source file upload failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="kind">Source kind</Label>
        <select
          id="kind"
          name="kind"
          defaultValue={SOURCE_FILE_KINDS[0]}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {SOURCE_FILE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {formatSourceFileKindLabel(kind as SourceFileKind)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Source file</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          className="block w-full text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-sm file:font-medium file:text-background"
          required
        />
      </div>

      {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="rounded-md" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : "Register and upload source file"}
      </Button>
    </form>
  );
}
