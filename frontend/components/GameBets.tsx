"use client";

import { useGameBets } from "@/components/GameBetsProvider";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-300",
  WON: "bg-green-500/20 text-green-300",
  LOST: "bg-red-500/20 text-red-300",
  VOID: "bg-gray-500/20 text-gray-300",
};

// Live list of the user's bets for this game. Data + polling live in
// GameBetsProvider; this just renders, so it stays in sync with the lock state.
export default function GameBets() {
  const { bets } = useGameBets();

  if (bets.length === 0) return null;

  return (
    <div className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-800/90 px-6 py-4 shadow-lg">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">
        Your bets this game
      </h3>
      <ul className="space-y-2">
        {bets.map((bet) => (
          <li
            key={bet.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/60 px-4 py-2 text-sm text-white"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium capitalize">{bet.selectedOutcomeLabel}</span>
              <span className="text-white/40">{bet.balls}-{bet.strikes}</span>
              <span className="text-green-400">
                {bet.oddsAmerican > 0 ? `+${bet.oddsAmerican}` : bet.oddsAmerican}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/60">
                ${bet.stake} → ${bet.potentialPayout}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  STATUS_STYLES[bet.status] ?? "bg-gray-500/20 text-gray-300"
                }`}
              >
                {bet.status}
                {bet.status !== "PENDING" && bet.settledOutcomeLabel
                  ? ` · ${bet.settledOutcomeLabel}`
                  : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
