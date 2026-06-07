import statsapi
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging
from typing import NamedTuple

# create a named tuple to store the current game state variables for each game_id
class GameState(NamedTuple):
    batter_id: int
    pitcher_id: int
    count: tuple[int, int]  # (balls, strikes)

# logging configuration
logging.basicConfig(level=logging.INFO)

# create the scheduler instance
scheduler = AsyncIOScheduler()

# store the last known game state for each game_id to compare against new data
_game_cursors: dict[int, GameState] = {} #Ex: 745123: GameState, game 745123 and current game data

# function to fetch game data and check for new pitches
async def fetch_game_data(game_id: int, on_new_pitch):

    # fetch game data from statsapi in a non-blocking way using run_in_executor to avoid blocking the event loop
    try:
        game_data = await asyncio.get_event_loop().run_in_executor(None, lambda: statsapi.get("game_playByPlay", {"gamePk": game_id}))
    except Exception as e:
        logging.error(f"Error fetching game data for game {game_id}: {e}")
        return
    
    # Get the current game state variables
    current_batter_id = game_data['currentPlay']['matchup']['batter']['id']
    current_pitcher_id = game_data['currentPlay']['matchup']['pitcher']['id']
    current_count = (game_data['currentPlay']['count']['balls'], game_data['currentPlay']['count']['strikes'])

    # store the current game state in a named tuple for easy comparison
    current_game_state = GameState(current_batter_id, current_pitcher_id, current_count)

    # check if current game state is different than the last known game state for this game_id
    last_game_state = _game_cursors.get(game_id)

    if last_game_state == current_game_state:
        logging.info(f"No new pitch for game {game_id}. Current state: {current_game_state}")
        return

    # update the last known game state for this game_id to the current game state
    _game_cursors[game_id] = current_game_state

    # if we get here, it means there is a new pitch, so we call the on_new_pitch callback with the game_id and current play data
    await on_new_pitch(game_id, game_data['currentPlay'])

# function to register a game for periodic data fetching and new pitch detection
def register_game(game_id: int, on_new_pitch, interval_seconds: float = 1.5):

    # create a unique job id for this game_id to avoid scheduling multiple jobs for the same game
    job_id = f"game_{game_id}"

    # Check if the job already exists for game
    if scheduler.get_job(job_id) is not None:
        return
    
    # schedule the job to run every interval_seconds
    scheduler.add_job(
        func=fetch_game_data,
        args = [game_id, on_new_pitch],
        trigger='interval',
        seconds=interval_seconds,
        id=job_id,
    )

# function to unregister a game and stop fetching data for it
def unregister_game(game_id: int):

    # create the job id for this game_id
    job_id = f"game_{game_id}"

    # check if the job exists before trying to remove it
    if scheduler.get_job(job_id) is not None:
        scheduler.remove_job(job_id)
        _game_cursors.pop(game_id, None)  # Remove the game state from the cursors dictionary when unregistering the game
    
    else: 
        logging.warning(f"Tried to unregister game {game_id} but no job was found with id {job_id}")

    


