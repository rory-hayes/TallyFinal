import { describe, expect, it } from "vitest";

import {
  getImportProfile,
  pickReusableTemplate,
  validateRequiredMappings,
  type MappingTemplateCandidate,
} from "../../lib/imports/mapping";

describe("validateRequiredMappings", () => {
  it("returns the missing required fields for the chosen import profile", () => {
    const profile = getImportProfile("generic_ie_payroll_csv");

    expect(
      validateRequiredMappings(profile, {
        employee_external_id: "Employee ID",
        employee_name: "Employee Name",
        gross_pay: "Gross Pay",
      }),
    ).toEqual(["net_pay"]);
  });
});

describe("pickReusableTemplate", () => {
  it("reuses the newest template for the same client profile and source kind when headers still match", () => {
    const templates: MappingTemplateCandidate[] = [
      {
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        importProfileKey: "generic_ie_payroll_csv",
        sourceKind: "current_payroll",
        templateId: "template_old",
        values: {
          employee_external_id: "Employee ID",
          employee_name: "Employee Name",
          gross_pay: "Gross Pay",
          net_pay: "Net Pay",
        },
      },
      {
        createdAt: new Date("2026-04-10T09:00:00.000Z"),
        importProfileKey: "generic_ie_payroll_csv",
        sourceKind: "current_payroll",
        templateId: "template_new",
        values: {
          employee_external_id: "Employee ID",
          employee_name: "Employee Name",
          gross_pay: "Gross Pay",
          net_pay: "Net Pay",
        },
      },
    ];

    expect(
      pickReusableTemplate({
        availableHeaders: [
          "Employee ID",
          "Employee Name",
          "Gross Pay",
          "Net Pay",
          "Department",
        ],
        importProfileKey: "generic_ie_payroll_csv",
        sourceKind: "current_payroll",
        templates,
      }),
    ).toEqual(templates[1]);
  });

  it("does not reuse a template when required mapped headers are missing from the new upload", () => {
    const templates: MappingTemplateCandidate[] = [
      {
        createdAt: new Date("2026-04-10T09:00:00.000Z"),
        importProfileKey: "generic_ie_payroll_csv",
        sourceKind: "current_payroll",
        templateId: "template_new",
        values: {
          employee_external_id: "Employee ID",
          employee_name: "Employee Name",
          gross_pay: "Gross Pay",
          net_pay: "Net Pay",
        },
      },
    ];

    expect(
      pickReusableTemplate({
        availableHeaders: ["Employee ID", "Employee Name", "Gross Pay"],
        importProfileKey: "generic_ie_payroll_csv",
        sourceKind: "current_payroll",
        templates,
      }),
    ).toBeNull();
  });
});
