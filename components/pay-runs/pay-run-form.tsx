import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PayRunFormProps = {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  defaults?: {
    title?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    payDate?: string | null;
  };
};

export function PayRunForm({
  action,
  submitLabel,
  defaults,
}: PayRunFormProps) {
  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Pay run title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults?.title ?? ""}
          placeholder="April 2026 payroll"
          required
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="periodStart">Period start</Label>
          <Input
            id="periodStart"
            name="periodStart"
            defaultValue={defaults?.periodStart ?? ""}
            type="date"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="periodEnd">Period end</Label>
          <Input
            id="periodEnd"
            name="periodEnd"
            defaultValue={defaults?.periodEnd ?? ""}
            type="date"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="payDate">Pay date</Label>
        <Input
          id="payDate"
          name="payDate"
          defaultValue={defaults?.payDate ?? ""}
          type="date"
        />
      </div>

      <Button type="submit" className="rounded-md">
        {submitLabel}
      </Button>
    </form>
  );
}
