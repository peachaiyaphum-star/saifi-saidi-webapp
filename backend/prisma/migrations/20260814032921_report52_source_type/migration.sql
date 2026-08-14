-- CreateEnum
CREATE TYPE "BatchSourceType" AS ENUM ('REPORT_50', 'REPORT_52');

-- AlterTable
ALTER TABLE "UploadBatch" ADD COLUMN     "sourceType" "BatchSourceType" NOT NULL DEFAULT 'REPORT_50';
