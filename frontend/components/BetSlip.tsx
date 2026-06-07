"use client";

import { useState } from "react";
import { useBankroll } from "@/components/BankrollProvider";

// The pitch a bet is bound to, snapshotted at the moment the user picks an
// outcome so a later streaming pitch can't silently change what they bet on.
export type BetSelection = {
  outcome: string; // wire label, e.g. "non-strike foul"
  odds: number; // signed American odds
  gameId: number;
  pitchSeq: number;
  atBatIndex: number;
  balls: number;
  strikes: number;
};

type BetSlipProps = {
  selection: BetSelection;
  // True once a newer pitch has streamed in: the snapshot is stale, so we block
  // confirmation and ask the user to re-pick at the current price.
  stale: boolean;
  onClose: () => void;
  onPlaced?: () => void;
};

// Display-only preview; the server recomputes the authoritative payout in Decimal.
function previewPayout(stake: number, odds: number): number {
  if (!Number.isFinite(stake) || stake <= 0) return 0;
  const profit = odds > 0 ? (stake * odds) / 100 : (stake * 100) / Math.abs(odds);
  return stake + profit;
}

export default function BetSlip({ selection, stale, onClose, onPlaced }: BetSlipProps) {
  const { bankroll, setBankroll } = useBankroll();
  const [stakeInput, setStakeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);

  const stakeNum = parseFloat(stakeInput);
  const bankrollNum = parseFloat(bankroll);
  const payout = previewPayout(stakeNum, selection.odds);

  const stakeValid =
    Number.isFinite(stakeNum) && stakeNum >= 0.01 && stakeNum <= bankrollNum;
  const canConfirm = stakeValid && !submitting && !stale && !placed;

  async function placeBet() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: selection.gameId,
          pitchSeq: selection.pitchSeq,
          atBatIndex: selection.atBatIndex,
          balls: selection.balls,
          strikes: selection.strikes,
          selectedOutcome: selection.outcome,
          oddsAmerican: selection.odds,
          stake: stakeInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not place bet");
        return;
      }
      setBankroll(data.bankroll);
      setPlaced(true);
      onPlaced?.();
    } catch {
      setError("Network error placing bet");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Bet slip
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/50 hover:text-white"
          aria-label="Close bet slip"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-white">
        <span className="font-medium capitalize">{selection.outcome}</span>
        <span className="font-semibold text-green-400">
          {selection.odds > 0 ? `+${selection.odds}` : selection.odds}
        </span>
      </div>

      {placed ? (
        <div className="mt-4 rounded-lg bg-green-600/20 p-3 text-center text-green-300">
          Bet placed! ${payout.toFixed(2)} to win.
        </div>
      ) : (
        <>
          <label className="mt-4 block text-xs text-white/60">Stake ($)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={stakeInput}
            onChange={(e) => setStakeInput(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-green-500"
          />

          <div className="mt-2 flex justify-between text-sm text-white/70">
            <span>Potential payout</span>
            <span className="font-semibold text-white">${payout.toFixed(2)}</span>
          </div>

          {stale && (
            <div className="mt-3 rounded-lg bg-yellow-600/20 p-2 text-center text-xs text-yellow-300">
              The pitch advanced — close and re-pick at the current odds.
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-lg bg-red-600/20 p-2 text-center text-xs text-red-300">
              {error}
            </div>
          )}
          {Number.isFinite(stakeNum) && stakeNum > bankrollNum && (
            <div className="mt-2 text-center text-xs text-red-300">
              Stake exceeds your bankroll (${bankroll}).
            </div>
          )}

          <button
            type="button"
            disabled={!canConfirm}
            onClick={placeBet}
            className="mt-4 w-full rounded-lg bg-green-600 py-2 font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-white/40"
          >
            {submitting ? "Placing…" : "Confirm bet"}
          </button>
        </>
      )}
    </div>
  );
}
