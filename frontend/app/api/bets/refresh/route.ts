import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runSettlement } from "@/lib/settlement";
import { serializeBet } from "@/lib/betSerializer";

// POST /api/bets/refresh — the live heartbeat for the game page. Settles the
// signed-in user's own pending bets against authoritative pitch results, then
// returns their fresh bets (optionally for one game) plus the current bankroll.
// User-authenticated (only ever touches the caller's bets), so no shared secret.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Optional gameId filter for the returned list (settlement still covers all
  // of the user's pending bets so the dashboard/navbar stay consistent).
  let gameId: number | undefined;
  try {
    const body = await request.json();
    if (typeof body?.gameId === "number") gameId = body.gameId;
  } catch {
    // no body / not JSON — fine, just return everything
  }

  const pending = await prisma.bet.findMany({ where: { status: "PENDING", userId } });
  if (pending.length > 0) {
    try {
      await runSettlement(pending);
    } catch (err) {
      // Don't fail the whole request if grading is briefly unavailable; the
      // client will try again on its next poll.
      console.error("refresh: settlement failed:", err);
    }
  }

  const bets = await prisma.bet.findMany({
    where: { userId, ...(gameId != null ? { gameId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bankroll: true },
  });

  return Response.json({
    bets: bets.map(serializeBet),
    bankroll: user?.bankroll.toFixed(2) ?? null,
  });
}
