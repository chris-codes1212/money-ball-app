import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.concurrency import asynccontextmanager
from fastapi.responses import HTMLResponse
from scheduler import register_game, scheduler, unregister_game
import live_games_utils
import utils
import stats
from odds import get_pitch_odds


from ws_manager import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

# Try and load model pipeline
try:
    ENTITY = 'chris-r-thompson1212-university-of-denver'
    PROJECT = "money-ball"
    model, labels = utils.load_production_model(
        ENTITY,
        PROJECT,
    )
    print("Model Loaded Successfully")
except FileNotFoundError:
    logging.error("Model not loaded. File not found.")
    model = None
    labels = None

async def on_new_pitch(game_id: int, data):
    
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