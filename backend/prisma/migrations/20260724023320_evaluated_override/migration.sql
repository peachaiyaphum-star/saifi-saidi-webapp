/*
  Warnings:

  - Made the column `evaluated` on table `OutageEvent` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "OutageEvent" ADD COLUMN     "evaluatedOverride" BOOLEAN,
ADD COLUMN     "overriddenAt" TIMESTAMP(3),
ADD COLUMN     "overriddenById" TEXT,
ALTER COLUMN "evaluated" SET NOT NULL,
ALTER COLUMN "evaluated" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "OutageEvent_evaluatedOverride_idx" ON "OutageEvent"("evaluatedOverride");

-- AddForeignKey
ALTER TABLE "OutageEvent" ADD CONSTRAINT "OutageEvent_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
