import type { SourceFileKind } from "@/lib/pay-runs/source-files";

export type ImportProfileField = {
  description: string;
  key: string;
  label: string;
  required: boolean;
};

export type ImportProfile = {
  description: string;
  fields: ImportProfileField[];
  key: string;
  label: string;
  sourceKinds: SourceFileKind[];
};

export const IMPORT_PROFILES: ImportProfile[] = [
  {
    key: "generic_ie_payroll_csv",
    label: "Generic Irish payroll CSV",
    description: "Employee-level payroll export with gross and net values.",
    sourceKinds: ["current_payroll", "previous_payroll"],
    fields: [
      {
        key: "employee_external_id",
        label: "Employee ID",
        description: "Stable employee identifier from the source file.",
        required: false,
      },
      {
        key: "employee_number",
        label: "Payroll number",
        description: "Employee payroll number for deterministic secondary matching.",
        required: false,
      },
      {
        key: "employee_name",
        label: "Employee name",
        description: "Employee display name for review.",
        required: true,
      },
      {
        key: "gross_pay",
        label: "Gross pay",
        description: "Current gross amount from the source file.",
        required: true,
      },
      {
        key: "net_pay",
        label: "Net pay",
        description: "Current net amount from the source file.",
        required: true,
      },
      {
        key: "department",
        label: "Department",
        description: "Optional reviewer context field.",
        required: false,
      },
      {
        key: "cost_centre",
        label: "Cost centre",
        description: "Optional cost centre or team code.",
        required: false,
      },
    ],
  },
  {
    key: "generic_journal_csv",
    label: "Generic journal CSV",
    description: "Journal-style ledger export with account and amount columns.",
    sourceKinds: ["journal"],
    fields: [
      {
        key: "entry_date",
        label: "Entry date",
        description: "Journal posting date.",
        required: true,
      },
      {
        key: "account_code",
        label: "Account code",
        description: "Nominal or general ledger account code.",
        required: true,
      },
      {
        key: "entry_description",
        label: "Description",
        description: "Journal line description.",
        required: true,
      },
      {
        key: "amount",
        label: "Amount",
        description: "Signed or debit/credit amount field.",
        required: true,
      },
    ],
  },
  {
    key: "generic_payment_csv",
    label: "Generic payment CSV",
    description: "Payment file with employee identity and payment amount.",
    sourceKinds: ["payment"],
    fields: [
      {
        key: "employee_external_id",
        label: "Employee ID",
        description: "Stable employee identifier from the payment export.",
        required: true,
      },
      {
        key: "employee_name",
        label: "Employee name",
        description: "Employee display name from the payment export.",
        required: true,
      },
      {
        key: "payment_amount",
        label: "Payment amount",
        description: "Outgoing payment amount.",
        required: true,
      },
      {
        key: "payment_reference",
        label: "Payment reference",
        description: "Optional bank or file reference.",
        required: false,
      },
      {
        key: "payment_date",
        label: "Payment date",
        description: "Optional payment date field.",
        required: false,
      },
    ],
  },
];

export function getImportProfile(profileKey: string) {
  const profile = IMPORT_PROFILES.find((candidate) => candidate.key === profileKey);

  if (!profile) {
    throw new Error(`Unknown import profile: ${profileKey}`);
  }

  return profile;
}

export function listImportProfilesForSourceKind(sourceKind: SourceFileKind) {
  return IMPORT_PROFILES.filter((profile) =>
    profile.sourceKinds.includes(sourceKind),
  );
}
