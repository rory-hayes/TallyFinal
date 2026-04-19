import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClientFormProps = {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  defaults?: {
    name?: string | null;
    legalName?: string | null;
    countryCode?: string | null;
    notes?: string | null;
  };
  destructiveAction?: (formData: FormData) => Promise<void>;
  destructiveLabel?: string;
};

export function ClientForm({
  action,
  submitLabel,
  defaults,
  destructiveAction,
  destructiveLabel,
}: ClientFormProps) {
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Client name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={defaults?.name ?? ""}
            placeholder="Acme Payroll Ltd"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="legalName">Legal name</Label>
          <Input
            id="legalName"
            name="legalName"
            defaultValue={defaults?.legalName ?? ""}
            placeholder="Acme Payroll Limited"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="countryCode">Country code</Label>
          <Input
            id="countryCode"
            name="countryCode"
            defaultValue={defaults?.countryCode ?? "IE"}
            placeholder="IE"
            maxLength={2}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={defaults?.notes ?? ""}
            placeholder="Operational notes for this client."
            rows={5}
          />
        </div>

        <Button type="submit" className="rounded-md">
          {submitLabel}
        </Button>
      </form>

      {destructiveAction && destructiveLabel ? (
        <form action={destructiveAction}>
          <Button type="submit" variant="destructive" className="rounded-md">
            {destructiveLabel}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
