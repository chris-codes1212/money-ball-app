-- CreateEnum
CREATE TYPE "PitchOutcome" AS ENUM ('STRIKE', 'BALL', 'HIT', 'NON_STRIKE_FOUL');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "bankroll" SET DATA TYPE DECIMAL(14,2);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "selectedOutcome" "PitchOutcome" NOT NULL,
    "stake" DECIMAL(14,2) NOT NULL,
    "oddsAmerican" INTEGER NOT NULL,
    "potentialPayout" DECIMAL(14,2) NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "pitchSeq" INTEGER NOT NULL,
    "atBatIndex" INTEGER NOT NULL,
    "balls" INTEGER NOT NULL,
    "strikes" INTEGER NOT NULL,
    "settledOutcome" "PitchOutcome",
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_gameId_pitchSeq_idx" ON "Bet"("gameId", "pitchSeq");

-- CreateIndex
CREATE INDEX "Bet_status_idx" ON "Bet"("status");

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
