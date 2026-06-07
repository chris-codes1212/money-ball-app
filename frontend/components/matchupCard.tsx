// 

"use client";

import { useEffect, useState } from "react";
import { getPlayerHeadshotUrl } from "@/lib/mlb";
import OddsButton from "@/components/oddsButton";
import BaseOccupancy from "@/components/baseOccupancy";
import BetSlip, { type BetSelection } from "@/components/BetSlip";
import { useGameBets } from "@/components/GameBetsProvider";

type GameData = {

  game_context: {
    game_id: number;
    pitch_seq: number;
    at_bat_index: number;
    batter_name: string;
    pitcher_name: string;
    batter_id: number;
    pitcher_id: number;
    strikes: number;
    balls: number;
    outs: number;
  };
  pitch_odds: {
    strike: number;
    ball: number;
    hit: number;
    "non-strike foul": number;
  };

  player_stats: {
    batter: {
      strike_rate: number;
      ball_rate: number;
      hit_rate: number;
    };
    pitcher: {
      strike_rate: number;
      ball_rate: number;
      hit_rate: number;
    };
  };

  base_occupancy: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  
};

export default function MatchupCard({ params }: { params: { game_id: string } }) {
  const [gameContext, setGameContext] = useState<GameData["game_context"] | null>(null);
  const [odds, setOdds] = useState<GameData["pitch_odds"] | null>(null);
  const [playerStats, setPlayerStats] = useState<GameData["player_stats"] | null>(null);
  const [baseOccupancy, setBaseOccupancy] = useState<GameData["base_occupancy"] | null>(null);

  // The pitch snapshot the user is currently building a bet on (null = no slip open).
  const [selection, setSelection] = useState<BetSelection | null>(null);

  // Betting is locked while the user has an unsettled bet on this game.
  const { locked, refresh } = useGameBets();

  useEffect(() => {
    // Browser-facing backend WS URL. Configurable per environment (compose maps
    // to the published localhost:8000; prod points at wss://<api-domain>).
    const wsBase = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000";
    const ws = new WebSocket(`${wsBase}/ws/${params.game_id}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as GameData;
      setGameContext(data.game_context);
      setOdds(data.pitch_odds);
      setPlayerStats(data.player_stats);
      setBaseOccupancy(data.base_occupancy);
    };

    return () => ws.close();
  }, [params.game_id]);

  // A bet is only valid against the pitch it was placed on. Once a newer pitch
  // streams in, the open slip is "stale" and confirmation is blocked.
  const selectionStale =
    selection !== null &&
    gameContext !== null &&
    gameContext.pitch_seq !== selection.pitchSeq;

  function handleSelect(outcome: string, oddsValue: number) {
    if (!gameContext || locked) return; // can't open a new bet while one is pending
    setSelection({
      outcome,
      odds: oddsValue,
      gameId: gameContext.game_id,
      pitchSeq: gameContext.pitch_seq,
      atBatIndex: gameContext.at_bat_index,
      balls: gameContext.balls,
      strikes: gameContext.strikes,
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-800/90 px-4 py-5 shadow-lg md:px-8 md:py-6">
      {gameContext ? (
        <div className="grid grid-cols-3 items-start justify-items-center gap-x-2 gap-y-3 md:gap-x-6 md:gap-y-4">
          {/* Header */}
          <div className="text-xs font-semibold uppercase tracking-wide text-white/70 md:text-sm">
            Pitcher
          </div>
          <div />
          <div className="text-xs font-semibold uppercase tracking-wide text-white/70 md:text-sm">
            Batter
          </div>

          {/* Players */}
          <div className="flex flex-col items-center gap-2 text-center">
            <img
              src={getPlayerHeadshotUrl(gameContext.pitcher_id, 60)}
              alt={gameContext.pitcher_name}
              className="h-12 w-12 rounded-full md:h-[60px] md:w-[60px]"
            />
            <div className="text-sm font-medium leading-tight text-white md:text-base">{gameContext.pitcher_name}</div>
          </div>

          <div className="self-center text-base font-bold text-white/70 md:text-lg">vs.</div>

          <div className="flex flex-col items-center gap-2 text-center">
            <img
              src={getPlayerHeadshotUrl(gameContext.batter_id, 60)}
              alt={gameContext.batter_name}
              className="h-12 w-12 rounded-full md:h-[60px] md:w-[60px]"
            />
            <div className="text-sm font-medium leading-tight text-white md:text-base">{gameContext.batter_name}</div>
          </div>

          {/* pitcher Stats */}
          <div className="mt-3 flex flex-col items-center gap-1.5 md:mt-4 md:gap-2">
            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white md:px-4 md:py-1 md:text-sm">
              Strike Rate: {(playerStats?.pitcher.strike_rate ?? 0)}%
            </div>
            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white md:px-4 md:py-1 md:text-sm">
              Ball Rate: {(playerStats?.pitcher.ball_rate ?? 0)}%
            </div>
            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white md:px-4 md:py-1 md:text-sm">
              Hit Rate: {(playerStats?.pitcher.hit_rate ?? 0)}%
            </div>
          </div>

          {/* SVG has a viewBox, so CSS width/height scale it: smaller on mobile,
              full 150px on md+ (laptop/iPad unchanged). */}
          <div className="[&_svg]:h-24 [&_svg]:w-24 md:[&_svg]:h-[150px] md:[&_svg]:w-[150px]">
            <BaseOccupancy
              first={baseOccupancy?.first ?? false}
              second={baseOccupancy?.second ?? false}
              third={baseOccupancy?.third ?? false}
              size={150}
            />
          </div>

          {/* batter Stats */}
          <div className="mt-3 flex flex-col items-center gap-1.5 md:mt-4 md:gap-2">
            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white md:px-4 md:py-1 md:text-sm">
              Strike Rate: {(playerStats?.batter.strike_rate ?? 0)}%
            </div>
            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white md:px-4 md:py-1 md:text-sm">
              Ball Rate: {(playerStats?.batter.ball_rate ?? 0)}%
            </div>
            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white md:px-4 md:py-1 md:text-sm">
              Hit Rate: {(playerStats?.batter.hit_rate ?? 0)}%
            </div>
          </div>


          {/* Metadata */}
          <div />
          <div className="mt-3 flex flex-col items-center gap-1.5 md:mt-4 md:gap-2">
            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white md:px-4 md:py-1 md:text-sm">
              Count: {gameContext.balls}-{gameContext.strikes}
            </div>
            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white md:px-4 md:py-1 md:text-sm">
              Outs: {gameContext.outs}
            </div>
          </div>
          <div />
        </div>
      ) : (
        <div className="py-8 text-center text-white/70">Loading matchup...</div>
      )}

      {odds ? (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-4">
          <OddsButton outcome="strike" odds={odds.strike} selected={selection?.outcome === "strike"} locked={locked} onSelect={handleSelect} />
          <OddsButton outcome="ball" odds={odds.ball} selected={selection?.outcome === "ball"} locked={locked} onSelect={handleSelect} />
          <OddsButton outcome="hit" odds={odds.hit} selected={selection?.outcome === "hit"} locked={locked} onSelect={handleSelect} />
          <OddsButton outcome="non-strike foul" odds={odds["non-strike foul"]} selected={selection?.outcome === "non-strike foul"} locked={locked} onSelect={handleSelect} />
        </div>
      ) : (
        <div className="mt-6 text-center text-white/60">Waiting for odds...</div>
      )}

      {/* While a bet is pending, betting is locked until it settles. */}
      {locked && (
        <div className="mt-4 rounded-lg bg-yellow-600/15 px-4 py-2 text-center text-sm text-yellow-300">
          🔒 Betting locked until your current bet settles.
        </div>
      )}

      {selection && !locked && (
        <BetSlip
          selection={selection}
          stale={selectionStale}
          onClose={() => setSelection(null)}
          onPlaced={() => {
            // Close the slip and refresh so the lock + bets panel update at once.
            setSelection(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}