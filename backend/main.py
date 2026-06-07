import logging

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.concurrency import asynccontextmanager
from fastapi.responses import HTMLResponse
from scheduler import register_game, scheduler, unregister_game
import live_games_utils
import settlement
import utils
import stats
from odds import get_pitch_odds


from ws_manager import manager

# Load backend/.env (W&B key, etc.) for local runs. In containers the env is
# injected directly, so this is a no-op there.
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

# Try to load the model pipeline. If anything goes wrong (missing artifact,
# W&B auth/network failure, etc.) we degrade gracefully to placeholder odds
# rather than crashing startup — get_pitch_odds handles model=None.
try:
    ENTITY = 'chris-r-thompson1212-university-of-denver'
    PROJECT = "money-ball"
    model, labels = utils.load_production_model(
        ENTITY,
        PROJECT,
    )
    print("Model Loaded Successfully")
except Exception as e:
    logging.error(f"Model not loaded ({type(e).__name__}: {e}). Falling back to placeholder odds.")
    model = None
    labels = None

# Monotonic per-game pitch sequence. Lets the frontend/ledger bind a bet to the
# exact pitch state it was placed on, so settlement can match bet -> result.
_pitch_seq: dict[int, int] = {}


async def on_new_pitch(game_id: int, data):

    seq = _pitch_seq.get(game_id, 0) + 1
    _pitch_seq[game_id] = seq

    pitch_odds = get_pitch_odds(data, model, labels)
    player_stats = stats.get_player_stats(model, data)  # Placeholder function to calculate player stats based on the current play data, replace with actual implementation
    base_occupancy = {
        "first": data['matchup'].get('postOnFirst') is not None,
        "second": data['matchup'].get('postOnSecond') is not None,
        "third": data['matchup'].get('postOnThird') is not None
    }

    payload = {
        "game_context": {
        "game_id": game_id,
        "pitch_seq": seq,
        "at_bat_index": data['atBatIndex'],
        "batter_name": data['matchup']['batter']['fullName'],
        "pitcher_name": data['matchup']['pitcher']['fullName'],
        "batter_id": data['matchup']['batter']['id'],
        "pitcher_id": data['matchup']['pitcher']['id'],
        "strikes": data['count']['strikes'],
        "balls": data['count']['balls'],
        "outs": data['count']['outs']
        },
        "pitch_odds": pitch_odds,
        "player_stats": player_stats,
        "base_occupancy": base_occupancy
    }

    await manager.broadcast(game_id=game_id, payload=payload)

@app.get("/")
async def get():
    return HTMLResponse(html)


@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: int):
    await manager.connect(game_id, websocket)
    register_game(game_id, on_new_pitch, interval_seconds=1.5)  # Register the game for the game_id
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
    
    if not manager._connections[game_id]:  # If there are no more connections for this game_id, unregister the game
        unregister_game(game_id)
        # await manager.broadcast(f"Client #{game_id} left the chat")

@app.get("/live_games")
def get_live_games():
    live_games = live_games_utils.get_today_games()
    return {"live_games": live_games}


@app.get("/games/{game_id}/pitch_results")
def get_pitch_results(game_id: int):
    # Authoritative, graded pitch results used by the settlement service to
    # grade PENDING bets. Read-only MLB data, so it's safe to expose.
    return settlement.get_pitch_results(game_id)