// 

"use client";

import { useEffect, useState } from "react";
import { getPlayerHeadshotUrl } from "@/lib/mlb";
import OddsButton from "@/components/oddsButton";
import BaseOccupancy from "@/components/baseOccupancy";
import BetSlip, { type BetSelection } from "@/components/BetSlip";

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

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${params.game_id}`);

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
    if (!gameContext) return;
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
    <div className="rounded-2xl border border-white/10 bg-slate-800/90 px-8 py-6 shadow-lg">
      {gameContext ? (
        <div className="grid grid-cols-3 items-start justify-items-center gap-x-6 gap-y-4">
          {/* Header */}
          <div className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Pitcher
          </div>
          <div />
          <div className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Batter
          </div>

          {/* Players */}
          <div className="flex flex-col items-center gap-2 text-center">
            <img
              src={getPlayerHeadshotUrl(gameContext.pitcher_id, 60)}
              alt={gameContext.pitcher_name}
              className="rounded-full"
            />
            <div className="font-medium text-white">{gameContext.pitcher_name}</div>
          </div>

          <div className="self-center text-lg font-bold text-white/70">vs.</div>

          <div className="flex flex-col items-center gap-2 text-center">
            <img
              src={getPlayerHeadshotUrl(gameContext.batter_id, 60)}
              alt={gameContext.batter_name}
              className="rounded-full"
            />
            <div className="font-medium text-white">{gameContext.batter_name}</div>
          </div>

          {/* pitcher Stats */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white">
              Strike Rate: {(playerStats?.pitcher.strike_rate ?? 0)}%
            </div>
            <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white">
              Ball Rate: {(playerStats?.pitcher.ball_rate ?? 0)}%
            </div>
            <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white">
              Hit Rate: {(playerStats?.pitcher.hit_rate ?? 0)}%
            </div>
          </div>

          <div>
            <BaseOccupancy
              first={baseOccupancy?.first ?? false}
              second={baseOccupancy?.second ?? false}
              third={baseOccupancy?.third ?? false}
              size={150}
            />
          </div>

          {/* batter Stats */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white">
              Strike Rate: {(playerStats?.batter.strike_rate ?? 0)}%
            </div>
            <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white">
              Ball Rate: {(playerStats?.batter.ball_rate ?? 0)}%
            </div>
            <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white">
              Hit Rate: {(playerStats?.batter.hit_rate ?? 0)}%
            </div>
          </div>


          {/* Metadata */}
          <div />
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white">
              Count: {gameContext.balls}-{gameContext.strikes}
            </div>
            <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white">
              Outs: {gameContext.outs}
            </div>
          </div>
          <div />
        </div>
      ) : (
        <div className="py-8 text-center text-white/70">Loading matchup...</div>
      )}

      {odds ? (
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <OddsButton outcome="strike" odds={odds.strike} selected={selection?.outcome === "strike"} onSelect={handleSelect} />
          <OddsButton outcome="ball" odds={odds.ball} selected={selection?.outcome === "ball"} onSelect={handleSelect} />
          <OddsButton outcome="hit" odds={odds.hit} selected={selection?.outcome === "hit"} onSelect={handleSelect} />
          <OddsButton outcome="non-strike foul" odds={odds["non-strike foul"]} selected={selection?.outcome === "non-strike foul"} onSelect={handleSelect} />
        </div>
      ) : (
        <div className="mt-6 text-center text-white/60">Waiting for odds...</div>
      )}

      {selection && (
        <BetSlip
          selection={selection}
          stale={selectionStale}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}