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
    <div className="flex w-full justify-center">
      <div className="relative w-full max-w-2xl cursor-not-allowed select-none opacity-50 grayscale">
        {children}
        {/* Lock note overlaid at the bottom; pointer-events-none so it never intercepts. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
            {note}
          </span>
        </div>
      </div>
    </div>
  );
}
