-- CreateEnum
CREATE TYPE "ReviewProcessingRunStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- AlterTable
ALTER TABLE "PayRun"
ADD COLUMN "activeReviewSnapshotVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EmployeeRunRecord"
ADD COLUMN "reviewSnapshotVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sourceRowNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ApprovalEvent"
ADD COLUMN "reviewSnapshotVersion" INTEGER;

-- CreateTable
CREATE TABLE "ReviewProcessingRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "currentSourceFileId" TEXT NOT NULL,
    "previousSourceFileId" TEXT NOT NULL,
    "currentMappingSignature" TEXT NOT NULL,
    "previousMappingSignature" TEXT NOT NULL,
    "initiatedByUserId" TEXT,
    "triggerRunId" TEXT,
    "status" "ReviewProcessingRunStatus" NOT NULL DEFAULT 'queued',
    "resultingSnapshotVersion" INTEGER,
    "errorMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewProcessingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeRunRecord_organizationId_payRunId_reviewSnapshotVersi_idx" ON "EmployeeRunRecord"("organizationId", "payRunId", "reviewSnapshotVersion", "recordScope");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRunRecord_sourceFileId_reviewSnapshotVersion_record_idx" ON "EmployeeRunRecord"("sourceFileId", "reviewSnapshotVersion", "recordScope", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "ApprovalEvent_organizationId_payRunId_reviewSnapshotVersion__idx" ON "ApprovalEvent"("organizationId", "payRunId", "reviewSnapshotVersion", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewProcessingRun_organizationId_payRunId_requestedAt_idx" ON "ReviewProcessingRun"("organizationId", "payRunId", "requestedAt");

-- CreateIndex
CREATE INDEX "ReviewProcessingRun_payRunId_status_requestedAt_idx" ON "ReviewProcessingRun"("payRunId", "status", "requestedAt");

-- AddForeignKey
ALTER TABLE "ReviewProcessingRun" ADD CONSTRAINT "ReviewProcessingRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewProcessingRun" ADD CONSTRAINT "ReviewProcessingRun_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewProcessingRun" ADD CONSTRAINT "ReviewProcessingRun_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
