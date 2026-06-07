import { Prisma } from "@/lib/generated/prisma/client";
import { PitchOutcome } from "@/lib/generated/prisma/enums";

// The FastAPI backend streams outcome labels as human-readable strings over the
// websocket (e.g. "non-strike foul"). The database stores them as an enum. These
// maps are the single source of truth for translating between the two.
export const WIRE_TO_OUTCOME: Record<string, PitchOutcome> = {
  strike: "STRIKE",
  ball: "BALL",
  hit: "HIT",
  "non-strike foul": "NON_STRIKE_FOUL",
};

export const OUTCOME_TO_WIRE: Record<PitchOutcome, string> = {
  STRIKE: "strike",
  BALL: "ball",
  HIT: "hit",
  NON_STRIKE_FOUL: "non-strike foul",
};

// Bet sizing / odds guardrails.
export const MIN_STAKE = new Prisma.Decimal("0.01");
export const MIN_ODDS_MAGNITUDE = 100; // American odds never have magnitude < 100
export const MAX_ODDS_MAGNITUDE = 100_000;

/** Resolve a wire label OR an enum value to a PitchOutcome, else null. */
export function toPitchOutcome(value: unknown): PitchOutcome | null {
  if (typeof value !== "string") return null;
  if (value in WIRE_TO_OUTCOME) return WIRE_TO_OUTCOME[value];
  if ((Object.values(PitchOutcome) as string[]).includes(value)) {
    return value as PitchOutcome;
  }
  return null;
}

/** Signed American odds are valid only as integers with magnitude in [100, 100000]. */
export function isOfferedOdds(odds: unknown): odds is number {
  return (
    typeof odds === "number" &&
    Number.isInteger(odds) &&
    Math.abs(odds) >= MIN_ODDS_MAGNITUDE &&
    Math.abs(odds) <= MAX_ODDS_MAGNITUDE
  );
}

/** Profit (excluding the returned stake) on a winning bet, rounded to cents. */
export function profitFromAmericanOdds(
  stake: Prisma.Decimal | string | number,
  odds: number,
): Prisma.Decimal {
  const s = new Prisma.Decimal(stake);
  const profit =
    odds > 0 ? s.mul(odds).div(100) : s.mul(100).div(Math.abs(odds));
  return profit.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Total returned to the bankroll on a win = stake + profit, rounded to cents. */
export function potentialPayout(
  stake: Prisma.Decimal | string | number,
  odds: number,
): Prisma.Decimal {
  const s = new Prisma.Decimal(stake);
  return s
    .plus(profitFromAmericanOdds(s, odds))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
