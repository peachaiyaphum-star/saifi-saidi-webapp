-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ENGINEER', 'VIEWER');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TargetCategory" AS ENUM ('GENERAL', 'INDUSTRIAL_ESTATE', 'CITY_MUNICIPALITY', 'WORST4');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "region" TEXT,
    "category" "TargetCategory" NOT NULL DEFAULT 'GENERAL',

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feeder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "officeId" TEXT,

    CONSTRAINT "Feeder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region" TEXT,
    "officesText" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "fileSaifiEvaluated" DOUBLE PRECISION,
    "fileSaidiEvaluated" DOUBLE PRECISION,
    "fileSaifiNotEvaluated" DOUBLE PRECISION,
    "fileSaidiNotEvaluated" DOUBLE PRECISION,
    "totalCustomers" INTEGER,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "anomalyCount" INTEGER NOT NULL DEFAULT 0,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutageEvent" (
    "id" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "eventNo" BIGINT NOT NULL,
    "sequenceNo" INTEGER,
    "outageAt" TIMESTAMP(3) NOT NULL,
    "restoreFirstAt" TIMESTAMP(3),
    "restoreFullAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "equipmentCode" TEXT,
    "feederCode" TEXT,
    "status" TEXT,
    "phase" TEXT,
    "subCause" TEXT,
    "causeKnown" TEXT,
    "officeName" TEXT,
    "weather" TEXT,
    "customersAffected" INTEGER,
    "location" TEXT,
    "repairDetail" TEXT,
    "loadMw" DOUBLE PRECISION,
    "eventType" TEXT,
    "customerMinutes" INTEGER,
    "evaluated" BOOLEAN,
    "anomalyFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" "TargetCategory" NOT NULL,
    "saifiTarget" DOUBLE PRECISION NOT NULL,
    "saidiTarget" DOUBLE PRECISION NOT NULL,
    "maifiTarget" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Office_code_key" ON "Office"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Feeder_code_key" ON "Feeder"("code");

-- CreateIndex
CREATE INDEX "UploadBatch_status_idx" ON "UploadBatch"("status");

-- CreateIndex
CREATE INDEX "OutageEvent_uploadBatchId_idx" ON "OutageEvent"("uploadBatchId");

-- CreateIndex
CREATE INDEX "OutageEvent_feederCode_idx" ON "OutageEvent"("feederCode");

-- CreateIndex
CREATE INDEX "OutageEvent_officeName_idx" ON "OutageEvent"("officeName");

-- CreateIndex
CREATE INDEX "OutageEvent_outageAt_idx" ON "OutageEvent"("outageAt");

-- CreateIndex
CREATE INDEX "OutageEvent_evaluated_idx" ON "OutageEvent"("evaluated");

-- CreateIndex
CREATE UNIQUE INDEX "Target_year_category_key" ON "Target"("year", "category");

-- AddForeignKey
ALTER TABLE "Feeder" ADD CONSTRAINT "Feeder_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutageEvent" ADD CONSTRAINT "OutageEvent_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
