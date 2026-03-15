-- CreateTable
CREATE TABLE "LoginStreak" (
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 1,
    "lastLoginDay" TEXT NOT NULL,

    CONSTRAINT "LoginStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FreeSpinBalance" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FreeSpinBalance_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FreeSpinGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreeSpinGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FreeSpinGrant_referenceId_key" ON "FreeSpinGrant"("referenceId");

-- CreateIndex
CREATE INDEX "FreeSpinGrant_userId_idx" ON "FreeSpinGrant"("userId");

-- AddForeignKey
ALTER TABLE "LoginStreak" ADD CONSTRAINT "LoginStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeSpinBalance" ADD CONSTRAINT "FreeSpinBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeSpinGrant" ADD CONSTRAINT "FreeSpinGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
