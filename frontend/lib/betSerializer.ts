import { Prisma } from "@/lib/generated/prisma/client";
import { OUTCOME_TO_WIRE } from "@/lib/betting";

// Serialize a Bet for the client. Money is Decimal in the DB, so we send it as
// fixed-2 strings (never floats), and we include a human wire label for display.
export function serializeBet(bet: {
  id: string;
  gameId: number;
  selectedOutcome: string;
  stake: Prisma.Decimal;
  oddsAmerican: number;
  potentialPayout: Prisma.Decimal;
  status: string;
  pitchSeq: number;
  atBatIndex: number;
  balls: number;
  strikes: number;
  settledOutcome: string | null;
  settledAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: bet.id,
    gameId: bet.gameId,
    selectedOutcome: bet.selectedOutcome,
    selectedOutcomeLabel:
      OUTCOME_TO_WIRE[bet.selectedOutcome as keyof typeof OUTCOME_TO_WIRE] ??
      bet.selectedOutcome,
    stake: bet.stake.toFixed(2),
    oddsAmerican: bet.oddsAmerican,
    potentialPayout: bet.potentialPayout.toFixed(2),
    status: bet.status,
    pitchSeq: bet.pitchSeq,
    atBatIndex: bet.atBatIndex,
    balls: bet.balls,
    strikes: bet.strikes,
    settledOutcome: bet.settledOutcome,
    settledOutcomeLabel: bet.settledOutcome
      ? OUTCOME_TO_WIRE[bet.settledOutcome as keyof typeof OUTCOME_TO_WIRE] ??
        bet.settledOutcome
      : null,
    settledAt: bet.settledAt?.toISOString() ?? null,
    createdAt: bet.createdAt.toISOString(),
  };
}
