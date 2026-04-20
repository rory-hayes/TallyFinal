-- CreateEnum
CREATE TYPE "ReconciliationCheckKind" AS ENUM ('payroll_to_journal', 'payroll_to_payment');

-- CreateEnum
CREATE TYPE "ReconciliationCheckStatus" AS ENUM ('matched', 'within_tolerance', 'mismatch');

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "entryDate" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "entryDescription" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "employeeExternalId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "paymentAmount" DECIMAL(18,2) NOT NULL,
    "paymentReference" TEXT,
    "paymentDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "checkKind" "ReconciliationCheckKind" NOT NULL,
    "status" "ReconciliationCheckStatus" NOT NULL,
    "payrollAmount" DECIMAL(18,2) NOT NULL,
    "comparisonAmount" DECIMAL(18,2) NOT NULL,
    "varianceAmount" DECIMAL(18,2) NOT NULL,
    "toleranceAmount" DECIMAL(18,2) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_sourceFileId_rowNumber_key" ON "JournalEntry"("sourceFileId", "rowNumber");

-- CreateIndex
CREATE INDEX "JournalEntry_organizationId_payRunId_idx" ON "JournalEntry"("organizationId", "payRunId");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceFileId_idx" ON "JournalEntry"("sourceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_sourceFileId_rowNumber_key" ON "PaymentRecord"("sourceFileId", "rowNumber");

-- CreateIndex
CREATE INDEX "PaymentRecord_organizationId_payRunId_idx" ON "PaymentRecord"("organizationId", "payRunId");

-- CreateIndex
CREATE INDEX "PaymentRecord_sourceFileId_idx" ON "PaymentRecord"("sourceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationCheck_sourceFileId_checkKind_key" ON "ReconciliationCheck"("sourceFileId", "checkKind");

-- CreateIndex
CREATE INDEX "ReconciliationCheck_organizationId_payRunId_status_idx" ON "ReconciliationCheck"("organizationId", "payRunId", "status");

-- CreateIndex
CREATE INDEX "ReconciliationCheck_clientId_payRunId_checkKind_idx" ON "ReconciliationCheck"("clientId", "payRunId", "checkKind");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCheck" ADD CONSTRAINT "ReconciliationCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCheck" ADD CONSTRAINT "ReconciliationCheck_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCheck" ADD CONSTRAINT "ReconciliationCheck_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCheck" ADD CONSTRAINT "ReconciliationCheck_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
