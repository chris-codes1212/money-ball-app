import { prisma } from "@/lib/prisma";
import { runSettlement } from "@/lib/settlement";

// POST /api/settle — settlement worker (cron/backstop). Settles ALL pending
// bets. Protected by a shared secret rather than user auth: it's an internal
// endpoint, and grading uses only authoritative MLB data so it can't be abused.
// Idempotent — safe to run on a schedule.
export async function POST(request: Request) {
  const secret = process.env.SETTLE_SECRET;
  if (!secret || request.headers.get("x-settle-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.bet.findMany({ where: { status: "PENDING" } });

  try {
    const summary = await runSettlement(pending);
    return Response.json(summary);
  } catch (err) {
    console.error("settle: run failed:", err);
    return Response.json({ error: "Settlement run failed" }, { status: 500 });
  }
}
