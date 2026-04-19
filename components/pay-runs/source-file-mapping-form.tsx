"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { ImportWorkspace } from "@/lib/imports/service";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type SaveMappingResult =
  | {
      notice: string;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

type SourceFileMappingFormProps = {
  saveMapping: (formData: FormData) => Promise<SaveMappingResult>;
  workspace: ImportWorkspace;
};

export function SourceFileMappingForm({
  saveMapping,
  workspace,
}: SourceFileMappingFormProps) {
  const router = useRouter();
  const [selectedProfileKey, setSelectedProfileKey] = useState(
    workspace.selectedProfileKey ?? workspace.availableProfiles[0]?.key ?? "",
  );
  const [mappingValues, setMappingValues] = useState(workspace.currentMappingValues);
  const [saveTemplate, setSaveTemplate] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () =>
      workspace.availableProfiles.find((profile) => profile.key === selectedProfileKey) ??
      workspace.availableProfiles[0],
    [selectedProfileKey, workspace.availableProfiles],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("importProfileKey", selectedProfileKey);

      if (saveTemplate) {
        formData.set("saveTemplate", "on");
      }

      for (const field of selectedProfile?.fields ?? []) {
        formData.set(`mapping:${field.key}`, mappingValues[field.key] ?? "");
      }

      const result = await saveMapping(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNotice(result.notice);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Mapping could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor={`profile-${workspace.sourceFileId}`}>Import profile</Label>
          <select
            id={`profile-${workspace.sourceFileId}`}
            value={selectedProfileKey}
            onChange={(event) => setSelectedProfileKey(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {workspace.availableProfiles.map((profile) => (
              <option key={profile.key} value={profile.key}>
                {profile.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {selectedProfile?.description}
          </p>
        </div>

        <div className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-3">
          <p className="text-sm font-medium text-foreground">
            Required fields must be mapped before this upload can move on.
          </p>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={saveTemplate}
              onChange={(event) => setSaveTemplate(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border border-input"
            />
            <span>
              Save this mapping as the default template for this client, profile,
              and source kind.
            </span>
          </label>
          {workspace.reusedTemplateName ? (
            <p className="text-xs text-muted-foreground">
              Reused template: {workspace.reusedTemplateName}
              {workspace.reusedTemplateUpdatedAt
                ? ` - updated ${new Intl.DateTimeFormat("en-IE", {
                    dateStyle: "medium",
                  }).format(workspace.reusedTemplateUpdatedAt)}`
                : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border/80">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-foreground">
                Target field
              </th>
              <th className="px-3 py-2 text-left font-medium text-foreground">
                Source header
              </th>
              <th className="px-3 py-2 text-left font-medium text-foreground">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {(selectedProfile?.fields ?? []).map((field) => (
              <tr key={field.key} className="border-t border-border/70 align-top">
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{field.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {field.required ? "Required" : "Optional"}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={mappingValues[field.key] ?? ""}
                    onChange={(event) =>
                      setMappingValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="flex h-10 w-full min-w-52 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Select a header</option>
                    {workspace.previewHeaders.map((header) => (
                      <option key={`${field.key}-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {field.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="rounded-md" disabled={isSubmitting}>
        {isSubmitting ? "Saving mapping..." : "Save mapping"}
      </Button>
    </form>
  );
}
