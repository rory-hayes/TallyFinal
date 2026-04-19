-- CreateEnum
CREATE TYPE "ExceptionCommentType" AS ENUM ('comment', 'audit_log');

-- AlterTable
ALTER TABLE "ExceptionComment"
ADD COLUMN "commentType" "ExceptionCommentType" NOT NULL DEFAULT 'comment',
ADD COLUMN "metadata" JSONB;
