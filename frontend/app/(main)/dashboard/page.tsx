import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { prisma } from "@/lib/prisma";
import { OUTCOME_TO_WIRE } from "@/lib/betting";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-300",
  WON: "bg-green-500/20 text-green-300",
  LOST: "bg-red-500/20 text-red-300",
  VOID: "bg-gray-500/20 text-gray-300",
};

export default async function Dashboard() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const [user, bets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { bankroll: true, username: true },
    }),
    prisma.bet.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  if (!user) {
    redirect("/auth/sign-in");
  }

  const pending = bets.filter((b) => b.status === "PENDING").length;

  return (
    <div className="flex justify-center px-4">
      <main className="w-full max-w-4xl py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {user.username ? `${user.username}'s` : "Your"} Dashboard
            </h1>
            <p className="text-white/70">
              Bankroll{" "}
              <span className="font-semibold text-green-400">
                ${user.bankroll.toFixed(2)}
              </span>
              {pending > 0 && (
                <span className="ml-3 text-white/50">{pending} pending</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/live-games"
              className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500"
            >
              Live games
            </Link>
            <SignOutButton />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Bet history</h2>

          {bets.length === 0 ? (
            <p className="py-8 text-center text-white/60">
              No bets yet. Head to a{" "}
              <Link href="/live-games" className="text-green-400 underline">
                live game
              </Link>{" "}
              to place your first one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/90">
                <thead className="text-xs uppercase tracking-wide text-white/50">
                  <tr>
                    <th className="px-3 py-2">Placed</th>
                    <th className="px-3 py-2">Game</th>
                    <th className="px-3 py-2">Pick</th>
                    <th className="px-3 py-2">Count</th>
                    <th className="px-3 py-2 text-right">Odds</th>
                    <th className="px-3 py-2 text-right">Stake</th>
                    <th className="px-3 py-2 text-right">To win</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bets.map((bet) => (
                    <tr key={bet.id}>
                      <td className="px-3 py-2 text-white/60">
                        {bet.createdAt.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-white/60">{bet.gameId}</td>
                      <td className="px-3 py-2 capitalize">
                        {OUTCOME_TO_WIRE[bet.selectedOutcome] ?? bet.selectedOutcome}
                      </td>
                      <td className="px-3 py-2 text-white/60">
                        {bet.balls}-{bet.strikes}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {bet.oddsAmerican > 0 ? `+${bet.oddsAmerican}` : bet.oddsAmerican}
                      </td>
                      <td className="px-3 py-2 text-right">${bet.stake.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        ${bet.potentialPayout.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            STATUS_STYLES[bet.status] ?? "bg-gray-500/20 text-gray-300"
                          }`}
                        >
                          {bet.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
