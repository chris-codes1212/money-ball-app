import { WIRE_TO_OUTCOME } from "@/lib/betting";
import { PitchOutcome } from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// One graded pitch as returned by the backend's /games/{id}/pitch_results.
// balls/strikes are the count BEFORE the pitch.
export type PitchResult = {
  atBatIndex: number;
  balls: number;
  strikes: number;
  outcome: string | null; // wire label, e.g. "non-strike foul", or null if ungradable
  startTime: string | null;
  pitchNumber: number | null;
};

export type Verdict =
  | { status: "WON" | "LOST"; settledOutcome: PitchOutcome | null }
  | { status: "VOID"; settledOutcome: null }
  | { status: "PENDING" };

// Just the bet fields settlement needs.
export type BetForSettlement = {
  atBatIndex: number;
  balls: number;
  strikes: number;
  selectedOutcome: PitchOutcome;
  createdAt: Date;
};

/**
 * Decide a pending bet's outcome against the authoritative pitch results.
 *
 * A bet is bound to the count it was placed on, so we look for the pitch thrown
 * from that exact (atBatIndex, balls, strikes). The bet predicts the *next*
 * pitch after it was placed, so among matches we prefer the first one thrown
 * after the bet's createdAt (this disambiguates a run of 2-strike fouls, which
 * all share the same pre-count).
 */
export function decideBet(
  bet: BetForSettlement,
  pitches: PitchResult[],
  currentAtBatIndex: number | null,
): Verdict {
  const matching = pitches.filter(
    (p) =>
      p.atBatIndex === bet.atBatIndex &&
      p.balls === bet.balls &&
      p.strikes === bet.strikes &&
      p.outcome != null,
  );

  const betTime = bet.createdAt.getTime();
  // Only grade against a pitch thrown strictly AFTER the bet was placed. Never
  // fall back to an earlier pitch — that would settle a late bet against an event
  // that already happened (letting it "win" on a known result).
  const candidate = matching.find(
    (p) => p.startTime != null && Date.parse(p.startTime) > betTime,
  );

  // Play has moved past this at-bat — used to decide when to give up waiting.
  const atBatPassed = currentAtBatIndex != null && bet.atBatIndex < currentAtBatIndex;

  if (candidate) {
    const actual = WIRE_TO_OUTCOME[candidate.outcome as string] ?? null;
    if (actual == null) {
      // Pitch couldn't be graded into a market; void once the at-bat is over.
      return atBatPassed ? { status: "VOID", settledOutcome: null } : { status: "PENDING" };
    }
    return {
      status: actual === bet.selectedOutcome ? "WON" : "LOST",
      settledOutcome: actual,
    };
  }

  // No pitch was ever thrown from that count. If play has already moved on, the
  // predicted pitch will never happen, so refund the stake. Otherwise wait.
  if (atBatPassed) return { status: "VOID", settledOutcome: null };
  return { status: "PENDING" };
}

// The bet fields runSettlement needs (a Prisma Bet row structurally satisfies this).
type SettleableBet = BetForSettlement & {
  id: string;
  userId: string;
  gameId: number;
  stake: Prisma.Decimal;
  potentialPayout: Prisma.Decimal;
};

export type SettleSummary = {
  processed: number;
  won: number;
  lost: number;
  void: number;
  stillPending: number;
  gamesFailed: number;
};

type PitchResultsResponse = {
  current_at_bat_index: number | null;
  pitches: PitchResult[];
};

/**
 * Settle a set of PENDING bets against the backend's authoritative pitch
 * results. Shared by the cron settle route (all bets) and the per-user live
 * refresh (one user's bets). Idempotent: re-checks status inside each txn, so
 * concurrent runs can't double-pay.
 */
export async function runSettlement(pending: SettleableBet[]): Promise<SettleSummary> {
  const backend = process.env.FAST_API_BACKEND_URL;
  if (!backend) throw new Error("FAST_API_BACKEND_URL not configured");

  const summary: SettleSummary = {
    processed: 0,
    won: 0,
    lost: 0,
    void: 0,
    stillPending: 0,
    gamesFailed: 0,
  };

  // Group by game so each game's results are fetched once.
  const byGame = new Map<number, SettleableBet[]>();
  for (const bet of pending) {
    const list = byGame.get(bet.gameId);
    if (list) list.push(bet);
    else byGame.set(bet.gameId, [bet]);
  }

  for (const [gameId, bets] of byGame) {
    let results: PitchResultsResponse;
    try {
      const res = await fetch(`${backend}/games/${gameId}/pitch_results`, { cache: "no-store" });
      if (!res.ok) throw new Error(`backend returned ${res.status}`);
      results = await res.json();
    } catch (err) {
      console.error(`settle: pitch_results failed for game ${gameId}:`, err);
      summary.gamesFailed++;
      summary.stillPending += bets.length;
      continue;
    }

    for (const bet of bets) {
      const verdict = decideBet(bet, results.pitches, results.current_at_bat_index);
      if (verdict.status === "PENDING") {
        summary.stillPending++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // Re-check inside the txn so concurrent settles can't double-process.
        const fresh = await tx.bet.findUnique({
          where: { id: bet.id },
          select: { status: true },
        });
        if (!fresh || fresh.status !== "PENDING") return;

        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: verdict.status,
            settledOutcome: verdict.settledOutcome,
            settledAt: new Date(),
          },
        });

        if (verdict.status === "WON") {
          // Credit the full payout (stake + profit); stake was debited at placement.
          await tx.user.update({
            where: { id: bet.userId },
            data: { bankroll: { increment: bet.potentialPayout } },
          });
        } else if (verdict.status === "VOID") {
          // Refund the stake.
          await tx.user.update({
            where: { id: bet.userId },
            data: { bankroll: { increment: bet.stake } },
          });
        }
      });

      summary.processed++;
      if (verdict.status === "WON") summary.won++;
      else if (verdict.status === "LOST") summary.lost++;
      else if (verdict.status === "VOID") summary.void++;
    }
  }

  return summary;
}
