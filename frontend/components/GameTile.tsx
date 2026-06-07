"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isGameBettable, msUntilBettable } from "@/lib/gameBetting";

type GameTileProps = {
  game: { game_id: number; status: string; start_time: string };
  children: React.ReactNode; // the server-rendered GameCard
};

function formatWait(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.max(mins, 1)}m`;
}

// Wraps a game card: a clickable link when betting is open, otherwise a greyed,
// non-clickable tile with a lock note. Re-evaluates over time so a tile unlocks
// on its own as first pitch approaches.
export default function GameTile({ game, children }: GameTileProps) {
  // Start null so server render and first client paint match (avoids hydration
  // mismatch), then fill in the real clock on mount and tick every 30s.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const bettable = now !== null && isGameBettable(game.status, game.start_time, now);

  if (bettable) {
    return (
      <Link href={`/games/${game.game_id}`} className="flex w-full justify-center">
        {children}
      </Link>
    );
  }

  const waitMs = now !== null ? msUntilBettable(game.start_time, now) : null;
  const note =
    waitMs && waitMs > 0
      ? `🔒 Betting opens in ${formatWait(waitMs)}`
      : "🔒 Betting not open yet";

  return (
    <div className="flex w-full flex-col items-center">
      {/* Greyed, non-clickable card... */}
      <div className="w-full max-w-2xl cursor-not-allowed select-none opacity-50 grayscale">
        {children}
      </div>
      {/* ...with the lock note in normal flow BELOW it (no overlap, full opacity). */}
      <div className="mt-2 w-full max-w-2xl rounded-lg bg-yellow-600/15 px-4 py-2 text-center text-sm font-semibold text-yellow-300">
        {note}
      </div>
    </div>
  );
}
