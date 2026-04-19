-- CreateEnum
CREATE TYPE "SourceFilePreviewStatus" AS ENUM ('pending', 'ready', 'failed');

-- AlterTable
ALTER TABLE "SourceFile"
ADD COLUMN     "importProfileKey" TEXT,
ADD COLUMN     "previewError" TEXT,
ADD COLUMN     "previewHeaders" JSONB,
ADD COLUMN     "previewRowCount" INTEGER,
ADD COLUMN     "previewSampleRows" JSONB,
ADD COLUMN     "previewSheetName" TEXT,
ADD COLUMN     "previewStatus" "SourceFilePreviewStatus" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "MappingTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sourceKind" "SourceFileKind" NOT NULL,
    "importProfileKey" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "columnMappings" JSONB NOT NULL,
    "sourceHeaders" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MappingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceColumnMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "targetFieldKey" TEXT NOT NULL,
    "sourceHeader" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceColumnMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MappingTemplate_organizationId_clientId_archivedAt_idx" ON "MappingTemplate"("organizationId", "clientId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MappingTemplate_organizationId_clientId_sourceKind_importProfileKey_key" ON "MappingTemplate"("organizationId", "clientId", "sourceKind", "importProfileKey");

-- CreateIndex
CREATE INDEX "SourceColumnMapping_organizationId_sourceFileId_idx" ON "SourceColumnMapping"("organizationId", "sourceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceColumnMapping_sourceFileId_targetFieldKey_key" ON "SourceColumnMapping"("sourceFileId", "targetFieldKey");

-- AddForeignKey
ALTER TABLE "MappingTemplate" ADD CONSTRAINT "MappingTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingTemplate" ADD CONSTRAINT "MappingTemplate_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceColumnMapping" ADD CONSTRAINT "SourceColumnMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceColumnMapping" ADD CONSTRAINT "SourceColumnMapping_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
