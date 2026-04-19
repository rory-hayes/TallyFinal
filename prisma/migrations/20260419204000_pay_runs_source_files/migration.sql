-- CreateEnum
CREATE TYPE "PayRunStatus" AS ENUM ('draft', 'collecting_files', 'ready_for_import', 'archived');

-- CreateEnum
CREATE TYPE "SourceFileKind" AS ENUM ('current_payroll', 'previous_payroll', 'journal', 'payment');

-- CreateEnum
CREATE TYPE "SourceFileStatus" AS ENUM ('registered', 'uploaded', 'superseded');

-- CreateTable
CREATE TABLE "PayRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3),
    "status" "PayRunStatus" NOT NULL DEFAULT 'draft',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "kind" "SourceFileKind" NOT NULL,
    "status" "SourceFileStatus" NOT NULL DEFAULT 'registered',
    "originalFilename" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "checksumSha256" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "replacementOfId" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayRun_organizationId_clientId_archivedAt_idx" ON "PayRun"("organizationId", "clientId", "archivedAt");

-- CreateIndex
CREATE INDEX "PayRun_clientId_status_idx" ON "PayRun"("clientId", "status");

-- CreateIndex
CREATE INDEX "PayRun_organizationId_status_idx" ON "PayRun"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayRun_id_organizationId_key" ON "PayRun"("id", "organizationId");

-- CreateIndex
CREATE INDEX "SourceFile_organizationId_payRunId_kind_idx" ON "SourceFile"("organizationId", "payRunId", "kind");

-- CreateIndex
CREATE INDEX "SourceFile_payRunId_status_idx" ON "SourceFile"("payRunId", "status");

-- CreateIndex
CREATE INDEX "SourceFile_replacementOfId_idx" ON "SourceFile"("replacementOfId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFile_id_payRunId_key" ON "SourceFile"("id", "payRunId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFile_payRunId_kind_version_key" ON "SourceFile"("payRunId", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFile_storageBucket_storagePath_key" ON "SourceFile"("storageBucket", "storagePath");

-- AddForeignKey
ALTER TABLE "PayRun" ADD CONSTRAINT "PayRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRun" ADD CONSTRAINT "PayRun_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_payRunId_organizationId_fkey" FOREIGN KEY ("payRunId", "organizationId") REFERENCES "PayRun"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_replacementOfId_fkey" FOREIGN KEY ("replacementOfId") REFERENCES "SourceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

