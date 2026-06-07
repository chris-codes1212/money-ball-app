import logging
import time

import statsapi

# Short-lived cache of pitch results per game. The settlement service may poll
# this once per second per active viewer; this bounds the actual MLB API calls
# to roughly one per game per TTL window regardless of poll volume.
_CACHE_TTL_SECONDS = 1.5
_results_cache: dict[int, tuple[float, dict]] = {}

# --- Pitch grading -----------------------------------------------------------
# Mirrors backend/src/data_loader.map_outcome_coarse (the labels the model was
# trained on) but operates on MLB StatsAPI playEvent fields instead of Statcast.
# Coarse outcomes match the betting markets: "strike" | "ball" | "hit" |
# "non-strike foul", or None when a pitch can't be graded into a market.

_BALL_CODES = {"B", "*B", "I", "P", "V"}        # ball, ball in dirt, intentional, pitchout, automatic ball
_STRIKE_CODES = {"C", "S", "W", "M", "Q", "K"}  # called, swinging, blocked swing, missed bunt, swing pitchout
_FOUL_CODES = {"F", "L", "R"}                    # foul, foul bunt, foul pitchout
_INPLAY_CODES = {"X", "D", "E"}                  # in play: out(s) / no out / run(s)

_BALL_DESCS = {
    "ball", "ball in dirt", "blocked ball", "intent ball", "intentional ball",
    "pitchout", "automatic ball", "automatic ball - pitch timer",
}


def grade_pitch(call_code, call_desc, is_in_play, strikes_before):
    """Classify a single pitch into a coarse betting outcome, or None.

    `strikes_before` is the strike count BEFORE this pitch — it decides whether a
    foul is a "non-strike foul" (only at 2 strikes) or just a "strike".
    """
    code = (call_code or "").strip().upper()
    desc = (call_desc or "").strip().lower()

    # A ball put in play (hit OR out) and a hit-by-pitch both grade as "hit",
    # matching the training labels (hit_into_play / hit_by_pitch -> "hit").
    if is_in_play or code in _INPLAY_CODES or desc.startswith("in play"):
        return "hit"
    if code == "H" or "hit by pitch" in desc:
        return "hit"

    # A foul tip is a caught strike, not a foul.
    if code == "T" or "foul tip" in desc:
        return "strike"

    # Other fouls are a distinct "non-strike foul" only with two strikes; with
    # fewer than two strikes a foul simply adds a strike.
    if code in _FOUL_CODES or "foul" in desc:
        return "non-strike foul" if strikes_before >= 2 else "strike"

    if code in _BALL_CODES or desc in _BALL_DESCS:
        return "ball"

    if code in _STRIKE_CODES or "strike" in desc or "missed bunt" in desc:
        return "strike"

    return None


def get_pitch_results(game_id: int) -> dict:
    """Every graded pitch in a game, tagged with the PRE-pitch count.

    The settlement service matches a bet (which is bound to the count it was
    placed on) to the pitch thrown from that count. Shape:

      {
        "current_at_bat_index": int | None,   # how far play has progressed
        "pitches": [
          {"atBatIndex", "balls", "strikes", "outcome", "startTime", "pitchNumber"}
        ]
      }
    """
    # Serve from cache if still fresh.
    now = time.time()
    cached = _results_cache.get(game_id)
    if cached and cached[0] > now:
        return cached[1]

    try:
        data = statsapi.get("game_playByPlay", {"gamePk": game_id})
    except Exception as e:
        logging.error(f"pitch_results: failed to fetch game {game_id}: {e}")
        return {"current_at_bat_index": None, "pitches": []}

    current_play = data.get("currentPlay", {})
    current_at_bat_index = current_play.get("atBatIndex")
    current_count = current_play.get("count", {})
    current_balls = current_count.get("balls")
    current_strikes = current_count.get("strikes")
    pitches = []

    for play in data.get("allPlays", []):
        at_bat_index = play.get("atBatIndex")
        # Reconstruct the pre-pitch count by walking pitches in order. Each
        # event's `count` is the count AFTER the pitch, so the count before a
        # pitch is the count after the previous one (0-0 at the at-bat start).
        balls_before, strikes_before = 0, 0
        for ev in play.get("playEvents", []):
            if not ev.get("isPitch"):
                continue
            det = ev.get("details", {})
            call = det.get("call", {})
            outcome = grade_pitch(
                call.get("code"), call.get("description"),
                det.get("isInPlay"), strikes_before,
            )
            pitches.append({
                "atBatIndex": at_bat_index,
                "balls": balls_before,
                "strikes": strikes_before,
                "outcome": outcome,
                "startTime": ev.get("startTime"),
                "pitchNumber": ev.get("pitchNumber"),
            })
            # Advance the running count to this pitch's authoritative post-count.
            cnt = ev.get("count", {})
            balls_before = cnt.get("balls", balls_before)
            strikes_before = cnt.get("strikes", strikes_before)

    result = {
        "current_at_bat_index": current_at_bat_index,
        "current_balls": current_balls,
        "current_strikes": current_strikes,
        "pitches": pitches,
    }
    _results_cache[game_id] = (now + _CACHE_TTL_SECONDS, result)
    return result
