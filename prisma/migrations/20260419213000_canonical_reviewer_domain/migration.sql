-- CreateEnum
CREATE TYPE "EmployeeRecordScope" AS ENUM ('current', 'previous');

-- CreateEnum
CREATE TYPE "EmployeePayComponentCategory" AS ENUM ('earning', 'deduction', 'employer_cost', 'other');

-- CreateEnum
CREATE TYPE "EmployeeMatchMethod" AS ENUM ('exact_identifier', 'manual', 'unmatched');

-- CreateEnum
CREATE TYPE "RuleResultStatus" AS ENUM ('passed', 'failed');

-- CreateEnum
CREATE TYPE "RuleResultSeverity" AS ENUM ('info', 'warning', 'blocker');

-- CreateEnum
CREATE TYPE "ReviewExceptionStatus" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ApprovalEventType" AS ENUM ('submitted', 'approved', 'rejected', 'reopened');

-- CreateTable
CREATE TABLE "EmployeeRunRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "recordScope" "EmployeeRecordScope" NOT NULL,
    "employeeExternalId" TEXT,
    "employeeNumber" TEXT,
    "employeeDisplayName" TEXT NOT NULL,
    "grossPay" DECIMAL(18,2),
    "netPay" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRunRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePayComponent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "employeeRunRecordId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "componentLabel" TEXT NOT NULL,
    "category" "EmployeePayComponentCategory" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,4),
    "unitRate" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRowRef" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "employeeRunRecordId" TEXT,
    "employeePayComponentId" TEXT,
    "sheetName" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "columnHeader" TEXT,
    "columnValue" TEXT,
    "canonicalFieldKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRowRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "currentEmployeeRunRecordId" TEXT NOT NULL,
    "previousEmployeeRunRecordId" TEXT,
    "matchMethod" "EmployeeMatchMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "employeeRunRecordId" TEXT NOT NULL,
    "employeePayComponentId" TEXT,
    "employeeMatchId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "resultStatus" "RuleResultStatus" NOT NULL DEFAULT 'failed',
    "severity" "RuleResultSeverity" NOT NULL,
    "ruleMessage" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewException" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "ruleResultId" TEXT NOT NULL,
    "reviewStatus" "ReviewExceptionStatus" NOT NULL DEFAULT 'open',
    "assigneeUserId" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExceptionComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "reviewExceptionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExceptionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" "ApprovalEventType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeRunRecord_organizationId_payRunId_recordScope_idx" ON "EmployeeRunRecord"("organizationId", "payRunId", "recordScope");

-- CreateIndex
CREATE INDEX "EmployeeRunRecord_sourceFileId_recordScope_idx" ON "EmployeeRunRecord"("sourceFileId", "recordScope");

-- CreateIndex
CREATE INDEX "EmployeeRunRecord_clientId_payRunId_idx" ON "EmployeeRunRecord"("clientId", "payRunId");

-- CreateIndex
CREATE INDEX "EmployeePayComponent_employeeRunRecordId_category_idx" ON "EmployeePayComponent"("employeeRunRecordId", "category");

-- CreateIndex
CREATE INDEX "EmployeePayComponent_organizationId_payRunId_idx" ON "EmployeePayComponent"("organizationId", "payRunId");

-- CreateIndex
CREATE INDEX "EmployeePayComponent_sourceFileId_idx" ON "EmployeePayComponent"("sourceFileId");

-- CreateIndex
CREATE INDEX "SourceRowRef_organizationId_payRunId_rowNumber_idx" ON "SourceRowRef"("organizationId", "payRunId", "rowNumber");

-- CreateIndex
CREATE INDEX "SourceRowRef_sourceFileId_rowNumber_idx" ON "SourceRowRef"("sourceFileId", "rowNumber");

-- CreateIndex
CREATE INDEX "SourceRowRef_employeeRunRecordId_idx" ON "SourceRowRef"("employeeRunRecordId");

-- CreateIndex
CREATE INDEX "SourceRowRef_employeePayComponentId_idx" ON "SourceRowRef"("employeePayComponentId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMatch_currentEmployeeRunRecordId_key" ON "EmployeeMatch"("currentEmployeeRunRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMatch_previousEmployeeRunRecordId_key" ON "EmployeeMatch"("previousEmployeeRunRecordId");

-- CreateIndex
CREATE INDEX "EmployeeMatch_organizationId_payRunId_idx" ON "EmployeeMatch"("organizationId", "payRunId");

-- CreateIndex
CREATE INDEX "EmployeeMatch_clientId_payRunId_idx" ON "EmployeeMatch"("clientId", "payRunId");

-- CreateIndex
CREATE INDEX "RuleResult_organizationId_payRunId_ruleCode_idx" ON "RuleResult"("organizationId", "payRunId", "ruleCode");

-- CreateIndex
CREATE INDEX "RuleResult_employeeRunRecordId_severity_idx" ON "RuleResult"("employeeRunRecordId", "severity");

-- CreateIndex
CREATE INDEX "RuleResult_employeeMatchId_idx" ON "RuleResult"("employeeMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewException_ruleResultId_key" ON "ReviewException"("ruleResultId");

-- CreateIndex
CREATE INDEX "ReviewException_organizationId_payRunId_reviewStatus_idx" ON "ReviewException"("organizationId", "payRunId", "reviewStatus");

-- CreateIndex
CREATE INDEX "ReviewException_clientId_payRunId_idx" ON "ReviewException"("clientId", "payRunId");

-- CreateIndex
CREATE INDEX "ExceptionComment_reviewExceptionId_createdAt_idx" ON "ExceptionComment"("reviewExceptionId", "createdAt");

-- CreateIndex
CREATE INDEX "ExceptionComment_organizationId_payRunId_idx" ON "ExceptionComment"("organizationId", "payRunId");

-- CreateIndex
CREATE INDEX "ApprovalEvent_organizationId_payRunId_createdAt_idx" ON "ApprovalEvent"("organizationId", "payRunId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalEvent_clientId_payRunId_idx" ON "ApprovalEvent"("clientId", "payRunId");

-- AddForeignKey
ALTER TABLE "EmployeeRunRecord" ADD CONSTRAINT "EmployeeRunRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRunRecord" ADD CONSTRAINT "EmployeeRunRecord_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRunRecord" ADD CONSTRAINT "EmployeeRunRecord_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRunRecord" ADD CONSTRAINT "EmployeeRunRecord_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayComponent" ADD CONSTRAINT "EmployeePayComponent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayComponent" ADD CONSTRAINT "EmployeePayComponent_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayComponent" ADD CONSTRAINT "EmployeePayComponent_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayComponent" ADD CONSTRAINT "EmployeePayComponent_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayComponent" ADD CONSTRAINT "EmployeePayComponent_employeeRunRecordId_fkey" FOREIGN KEY ("employeeRunRecordId") REFERENCES "EmployeeRunRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRowRef" ADD CONSTRAINT "SourceRowRef_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRowRef" ADD CONSTRAINT "SourceRowRef_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRowRef" ADD CONSTRAINT "SourceRowRef_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRowRef" ADD CONSTRAINT "SourceRowRef_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRowRef" ADD CONSTRAINT "SourceRowRef_employeeRunRecordId_fkey" FOREIGN KEY ("employeeRunRecordId") REFERENCES "EmployeeRunRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRowRef" ADD CONSTRAINT "SourceRowRef_employeePayComponentId_fkey" FOREIGN KEY ("employeePayComponentId") REFERENCES "EmployeePayComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMatch" ADD CONSTRAINT "EmployeeMatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMatch" ADD CONSTRAINT "EmployeeMatch_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMatch" ADD CONSTRAINT "EmployeeMatch_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMatch" ADD CONSTRAINT "EmployeeMatch_currentEmployeeRunRecordId_fkey" FOREIGN KEY ("currentEmployeeRunRecordId") REFERENCES "EmployeeRunRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMatch" ADD CONSTRAINT "EmployeeMatch_previousEmployeeRunRecordId_fkey" FOREIGN KEY ("previousEmployeeRunRecordId") REFERENCES "EmployeeRunRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_employeeRunRecordId_fkey" FOREIGN KEY ("employeeRunRecordId") REFERENCES "EmployeeRunRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_employeePayComponentId_fkey" FOREIGN KEY ("employeePayComponentId") REFERENCES "EmployeePayComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_employeeMatchId_fkey" FOREIGN KEY ("employeeMatchId") REFERENCES "EmployeeMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewException" ADD CONSTRAINT "ReviewException_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewException" ADD CONSTRAINT "ReviewException_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewException" ADD CONSTRAINT "ReviewException_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewException" ADD CONSTRAINT "ReviewException_ruleResultId_fkey" FOREIGN KEY ("ruleResultId") REFERENCES "RuleResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionComment" ADD CONSTRAINT "ExceptionComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionComment" ADD CONSTRAINT "ExceptionComment_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionComment" ADD CONSTRAINT "ExceptionComment_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionComment" ADD CONSTRAINT "ExceptionComment_reviewExceptionId_fkey" FOREIGN KEY ("reviewExceptionId") REFERENCES "ReviewException"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
