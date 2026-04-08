-- CreateTable
CREATE TABLE "UserInviteToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "UserInviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserInviteToken_tokenHash_key" ON "UserInviteToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInviteToken_email_idx" ON "UserInviteToken"("email");

-- CreateIndex
CREATE INDEX "UserInviteToken_expiresAt_idx" ON "UserInviteToken"("expiresAt");
