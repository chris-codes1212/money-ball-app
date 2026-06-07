import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  MIN_STAKE,
  isOfferedOdds,
  potentialPayout,
  toPitchOutcome,
} from "@/lib/betting";
import { serializeBet } from "@/lib/betSerializer";

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

// POST /api/bets — place a fake bet. Debits the stake from the bankroll and
// records a PENDING bet, atomically, in a single transaction.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { gameId, pitchSeq, atBatIndex, balls, strikes, selectedOutcome, oddsAmerican, stake } =
      body;

    // --- shape validation -------------------------------------------------
    if (
      !isNonNegativeInt(gameId) ||
      !isNonNegativeInt(pitchSeq) ||
      !isNonNegativeInt(atBatIndex) ||
      !isNonNegativeInt(balls) ||
      !isNonNegativeInt(strikes)
    ) {
      return Response.json(
        { error: "gameId, pitchSeq, atBatIndex, balls and strikes must be non-negative integers" },
        { status: 400 },
      );
    }

    const outcome = toPitchOutcome(selectedOutcome);
    if (!outcome) {
      return Response.json({ error: "Unknown selectedOutcome" }, { status: 400 });
    }

    if (!isOfferedOdds(oddsAmerican)) {
      return Response.json({ error: "Invalid or unoffered odds" }, { status: 400 });
    }

    // --- baseball legality of the selection -------------------------------
    // A terminal count means the at-bat is already decided; nothing is gradable.
    if (strikes >= 3 || balls >= 4 || balls > 3 || strikes > 2) {
      return Response.json(
        { error: "No pitch is offered at this count" },
        { status: 409 },
      );
    }
    // A foul only counts as a "non-strike foul" with 2 strikes; otherwise it's a strike.
    if (outcome === "NON_STRIKE_FOUL" && strikes < 2) {
      return Response.json(
        { error: "Non-strike foul is only offered with two strikes" },
        { status: 409 },
      );
    }

    // --- stake validation -------------------------------------------------
    if (typeof stake !== "string" && typeof stake !== "number") {
      return Response.json({ error: "Invalid stake" }, { status: 400 });
    }
    let stakeDec: Prisma.Decimal;
    try {
      stakeDec = new Prisma.Decimal(stake);
    } catch {
      return Response.json({ error: "Invalid stake" }, { status: 400 });
    }
    if (!stakeDec.isFinite() || stakeDec.lessThan(MIN_STAKE)) {
      return Response.json({ error: "Stake must be at least 0.01" }, { status: 400 });
    }
    if (stakeDec.decimalPlaces() > 2) {
      return Response.json(
        { error: "Stake cannot have more than 2 decimal places" },
        { status: 400 },
      );
    }

    const payout = potentialPayout(stakeDec, oddsAmerican);

    // --- atomic debit + create -------------------------------------------
    const bet = await prisma.$transaction(async (tx) => {
      // One live bet per game: lock out new bets while one is still pending.
      const existingPending = await tx.bet.findFirst({
        where: { userId, gameId, status: "PENDING" },
        select: { id: true },
      });
      if (existingPending) throw new GameLockedError();

      // Atomic, race-safe debit: only succeeds if the bankroll still covers it.
      const debit = await tx.user.updateMany({
        where: { id: userId, bankroll: { gte: stakeDec } },
        data: { bankroll: { decrement: stakeDec } },
      });
      if (debit.count === 0) {
        throw new InsufficientFundsError();
      }
      return tx.bet.create({
        data: {
          userId,
          gameId,
          pitchSeq,
          atBatIndex,
          balls,
          strikes,
          selectedOutcome: outcome,
          oddsAmerican,
          stake: stakeDec,
          potentialPayout: payout,
        },
      });
    });

    const { bankroll } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { bankroll: true },
    });

    return Response.json(
      { bet: serializeBet(bet), bankroll: bankroll.toFixed(2) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GameLockedError) {
      return Response.json(
        { error: "You already have a pending bet on this game. Wait for it to settle." },
        { status: 409 },
      );
    }
    if (error instanceof InsufficientFundsError) {
      return Response.json({ error: "Insufficient bankroll" }, { status: 402 });
    }
    console.error("Error placing bet:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/bets — the signed-in user's bet history (most recent first).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bets = await prisma.bet.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return Response.json({ bets: bets.map(serializeBet) }, { status: 200 });
  } catch (error) {
    console.error("Error fetching bets:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

class InsufficientFundsError extends Error {}
class GameLockedError extends Error {}
