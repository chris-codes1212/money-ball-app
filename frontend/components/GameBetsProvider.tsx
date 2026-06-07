"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useBankroll } from "@/components/BankrollProvider";

export type GameBet = {
  id: string;
  selectedOutcomeLabel: string;
  stake: string;
  oddsAmerican: number;
  potentialPayout: string;
  status: string;
  balls: number;
  strikes: number;
  settledOutcomeLabel: string | null;
};

type GameBetsContextValue = {
  bets: GameBet[];
  // True while the user has any unsettled bet on this game — betting is locked
  // until their last pending bet settles.
  locked: boolean;
  refresh: () => void;
};

const GameBetsContext = createContext<GameBetsContextValue | null>(null);

// Owns the per-game live polling: settles the user's pending bets (~1.5s),
// keeps the navbar balance in sync, and exposes the lock state shared by the
// odds buttons (MatchupCard) and the bets panel (GameBets).
export function GameBetsProvider({
  gameId,
  children,
}: {
  gameId: number;
  children: React.ReactNode;
}) {
  const { setBankroll } = useBankroll();
  const [bets, setBets] = useState<GameBet[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/bets/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setBets(data.bets ?? []);
      if (data.bankroll) setBankroll(data.bankroll);
    } catch {
      // transient; the next tick retries
    }
  }, [gameId, setBankroll]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [refresh]);

  const locked = bets.some((b) => b.status === "PENDING");

  return (
    <GameBetsContext.Provider value={{ bets, locked, refresh }}>
      {children}
    </GameBetsContext.Provider>
  );
}

export function useGameBets() {
  const ctx = useContext(GameBetsContext);
  if (!ctx) throw new Error("useGameBets must be used within a GameBetsProvider");
  return ctx;
}
