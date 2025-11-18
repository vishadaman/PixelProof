/*
  Warnings:

  - Added the required column `updatedAt` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "figmaFrameId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "FigmaCredential" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FigmaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "figmaFileKey" TEXT NOT NULL,
    "figmaFrameId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaselineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FigmaCredential_projectId_key" ON "FigmaCredential"("projectId");

-- CreateIndex
CREATE INDEX "FigmaCredential_projectId_idx" ON "FigmaCredential"("projectId");

-- CreateIndex
CREATE INDEX "BaselineSnapshot_projectId_idx" ON "BaselineSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "BaselineSnapshot_projectId_createdAt_idx" ON "BaselineSnapshot"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- AddForeignKey
ALTER TABLE "FigmaCredential" ADD CONSTRAINT "FigmaCredential_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineSnapshot" ADD CONSTRAINT "BaselineSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
