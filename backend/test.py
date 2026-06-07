from odds import get_pitch_odds
from live_games_utils import get_live_games, get_yesterday_games
import json
import statsapi
import logging

import utils

def load_model():
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
    return model, labels

def main():
    model, labels = load_model()

    print(get_yesterday_games()[0])

    # game_data = statsapi.get("game_playByPlay", {"gamePk": game_id})
    
    data = statsapi.get("game_playByPlay", {"gamePk": 824295})['currentPlay']
    
    pitch_odds = get_pitch_odds(data, model, labels) 
    pitch_odds = {k: round(float(v), 4) for k, v in pitch_odds.items()}
    # odds = get_odds(play_data)
    # print(json.dumps(odds, indent=4))

if __name__ == "__main__":
    main()