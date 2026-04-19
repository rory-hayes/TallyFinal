import type { NormalizedEmployeeRunRecord } from "@/lib/imports/payroll-normalization";

export type EmployeeMatchMethod =
  | "employee_external_id"
  | "employee_name_exact"
  | "employee_number";

export type CurrentEmployeeMatchResult = {
  ambiguousCandidateRecordKeys?: string[];
  confidence: "high" | "low" | "none";
  currentEmployeeDisplayName: string;
  currentRecordKey: string;
  matchMethod: EmployeeMatchMethod | null;
  previousEmployeeDisplayName?: string;
  previousRecordKey?: string;
  reason?: "duplicate_name" | "no_previous_match";
  status: "ambiguous_match" | "matched" | "new_employee";
};

export type MissingPreviousEmployeeResult = {
  previousEmployeeDisplayName: string;
  previousRecordKey: string;
  reason: "missing_from_current";
  status: "missing_employee";
};

export type EmployeeRunMatchingResult = {
  currentMatches: CurrentEmployeeMatchResult[];
  missingPreviousRecords: MissingPreviousEmployeeResult[];
};

type MatchEmployeeRunRecordsInput = {
  currentRecords: NormalizedEmployeeRunRecord[];
  previousRecords: NormalizedEmployeeRunRecord[];
};

function normalizeMatchKey(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function buildIndex(
  records: NormalizedEmployeeRunRecord[],
  selector: (record: NormalizedEmployeeRunRecord) => string,
) {
  const index = new Map<string, NormalizedEmployeeRunRecord[]>();

  records.forEach((record) => {
    const key = selector(record);

    if (!key) {
      return;
    }

    const current = index.get(key) ?? [];
    current.push(record);
    index.set(key, current);
  });

  return index;
}

function buildCountMap(
  records: NormalizedEmployeeRunRecord[],
  selector: (record: NormalizedEmployeeRunRecord) => string,
) {
  const counts = new Map<string, number>();

  records.forEach((record) => {
    const key = selector(record);

    if (!key) {
      return;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return counts;
}

function findUnmatchedCandidate(
  candidates: NormalizedEmployeeRunRecord[] | undefined,
  matchedPreviousKeys: Set<string>,
) {
  if (!candidates?.length) {
    return null;
  }

  const availableCandidates = candidates.filter(
    (candidate) => !matchedPreviousKeys.has(candidate.recordKey),
  );

  if (availableCandidates.length !== 1) {
    return null;
  }

  return availableCandidates[0];
}

export function matchEmployeeRunRecords(
  input: MatchEmployeeRunRecordsInput,
): EmployeeRunMatchingResult {
  const previousByExternalId = buildIndex(input.previousRecords, (record) =>
    normalizeMatchKey(record.employeeExternalId),
  );
  const previousByEmployeeNumber = buildIndex(input.previousRecords, (record) =>
    normalizeMatchKey(record.employeeNumber),
  );
  const previousByName = buildIndex(input.previousRecords, (record) =>
    normalizeMatchKey(record.employeeDisplayName),
  );
  const currentNameCounts = buildCountMap(input.currentRecords, (record) =>
    normalizeMatchKey(record.employeeDisplayName),
  );
  const matchedPreviousKeys = new Set<string>();
  const ambiguousPreviousKeys = new Set<string>();

  const currentMatches = input.currentRecords.map<CurrentEmployeeMatchResult>((record) => {
    const externalIdKey = normalizeMatchKey(record.employeeExternalId);
    const previousExternalIdCandidates = externalIdKey
      ? previousByExternalId.get(externalIdKey)
      : undefined;
    const externalIdMatch = findUnmatchedCandidate(
      previousExternalIdCandidates,
      matchedPreviousKeys,
    );

    if (externalIdMatch) {
      matchedPreviousKeys.add(externalIdMatch.recordKey);

      return {
        confidence: "high",
        currentEmployeeDisplayName: record.employeeDisplayName,
        currentRecordKey: record.recordKey,
        matchMethod: "employee_external_id",
        previousEmployeeDisplayName: externalIdMatch.employeeDisplayName,
        previousRecordKey: externalIdMatch.recordKey,
        status: "matched",
      };
    }

    const employeeNumberKey = normalizeMatchKey(record.employeeNumber);
    const previousEmployeeNumberCandidates = employeeNumberKey
      ? previousByEmployeeNumber.get(employeeNumberKey)
      : undefined;
    const employeeNumberMatch = findUnmatchedCandidate(
      previousEmployeeNumberCandidates,
      matchedPreviousKeys,
    );

    if (employeeNumberMatch) {
      matchedPreviousKeys.add(employeeNumberMatch.recordKey);

      return {
        confidence: "high",
        currentEmployeeDisplayName: record.employeeDisplayName,
        currentRecordKey: record.recordKey,
        matchMethod: "employee_number",
        previousEmployeeDisplayName: employeeNumberMatch.employeeDisplayName,
        previousRecordKey: employeeNumberMatch.recordKey,
        status: "matched",
      };
    }

    const normalizedName = normalizeMatchKey(record.employeeDisplayName);
    const previousNameCandidates = normalizedName
      ? previousByName.get(normalizedName) ?? []
      : [];
    const currentNameCount = currentNameCounts.get(normalizedName) ?? 0;

    if (normalizedName && (currentNameCount > 1 || previousNameCandidates.length > 1)) {
      previousNameCandidates.forEach((candidate) => {
        ambiguousPreviousKeys.add(candidate.recordKey);
      });

      return {
        ambiguousCandidateRecordKeys: previousNameCandidates.map(
          (candidate) => candidate.recordKey,
        ),
        confidence: "none",
        currentEmployeeDisplayName: record.employeeDisplayName,
        currentRecordKey: record.recordKey,
        matchMethod: null,
        reason: "duplicate_name",
        status: "ambiguous_match",
      };
    }

    const nameMatch = findUnmatchedCandidate(previousNameCandidates, matchedPreviousKeys);

    if (nameMatch) {
      matchedPreviousKeys.add(nameMatch.recordKey);

      return {
        confidence: "low",
        currentEmployeeDisplayName: record.employeeDisplayName,
        currentRecordKey: record.recordKey,
        matchMethod: "employee_name_exact",
        previousEmployeeDisplayName: nameMatch.employeeDisplayName,
        previousRecordKey: nameMatch.recordKey,
        status: "matched",
      };
    }

    return {
      confidence: "none",
      currentEmployeeDisplayName: record.employeeDisplayName,
      currentRecordKey: record.recordKey,
      matchMethod: null,
      reason: "no_previous_match",
      status: "new_employee",
    };
  });

  const missingPreviousRecords = input.previousRecords
    .filter((record) => !matchedPreviousKeys.has(record.recordKey))
    .filter((record) => !ambiguousPreviousKeys.has(record.recordKey))
    .map<MissingPreviousEmployeeResult>((record) => ({
      previousEmployeeDisplayName: record.employeeDisplayName,
      previousRecordKey: record.recordKey,
      reason: "missing_from_current",
      status: "missing_employee",
    }));

  return {
    currentMatches,
    missingPreviousRecords,
  };
}
