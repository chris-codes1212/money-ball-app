// Single source of truth for "can a user bet on this game yet?" Used by the
// live-games UI (to grey out tiles) and by the game page's server-side guard.
//
// Rule: betting is allowed only when the game is actually live, or within 5
// minutes of first pitch. Scheduled games further out are locked, even though
// the backend may already be streaming the upcoming matchup.

export const BETTABLE_WINDOW_MS = 5 * 60 * 1000;

// Statuses that mean the game is underway (always bettable).
const LIVE_HINTS = ["in progress", "live", "manager challenge"];
// Statuses that mean it's over / not playable (never bettable).
const CLOSED_HINTS = ["final", "completed", "game over", "postponed", "suspended", "cancelled"];

export function isGameBettable(
  status: string | undefined,
  startTimeISO: string | undefined,
  now: number = Date.now(),
): boolean {
  const s = (status ?? "").toLowerCase();
  if (CLOSED_HINTS.some((h) => s.includes(h))) return false;
  if (LIVE_HINTS.some((h) => s.includes(h))) return true;

  // Otherwise (Scheduled / Pre-Game / Warmup): only within the pre-start window.
  if (!startTimeISO) return false;
  const start = Date.parse(startTimeISO);
  if (Number.isNaN(start)) return false;
  return start - now <= BETTABLE_WINDOW_MS;
}

/** Milliseconds until the betting window opens (<=0 once open). null if unknown. */
export function msUntilBettable(
  startTimeISO: string | undefined,
  now: number = Date.now(),
): number | null {
  if (!startTimeISO) return null;
  const start = Date.parse(startTimeISO);
  if (Number.isNaN(start)) return null;
  return start - BETTABLE_WINDOW_MS - now;
}
