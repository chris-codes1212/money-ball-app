import os
import re
import pickle
import joblib
import wandb
import pandas as pd


def load_production_model(
    entity, project, model_name="pitch-odds-model"
):
    """
    Load production model pipeline from W&B artifact.
    Returns: model
    """

    # Login to W&B (uses WANDB_API_KEY env variable)
    wandb.login(key=os.environ["WANDB_API_KEY"])

    api = wandb.Api()

    # Fetch the production artifact
    artifact = api.artifact(
        f"{entity}/{project}/{model_name}:production", type="model"
    )

    labels = artifact.metadata.get("labels", ['strike', 'ball', 'hit', 'ns foul'])

    # Download the artifact locally
    artifact_path = artifact.download()

    # Load Keras model
    model_file = f"{artifact_path}/model.pkl"
    model = joblib.load(model_file)

    return model, labels

def get_relative_scores(play_data):
    is_top = play_data['about']['isTopInning']
    home_score = play_data['result']['homeScore']
    away_score = play_data['result']['awayScore']
    
    if is_top:
        batting_score = away_score
        fielding_score = home_score
    else:
        batting_score = home_score
        fielding_score = away_score
        
    return batting_score, fielding_score

def preprocess_play_data(current_pitch):
    bat_score, fld_score = get_relative_scores(current_pitch)
    df = pd.DataFrame([{
        "pitcher": current_pitch['matchup']['pitcher']['id'], #current_pitch['matchup']['pitcher']['id']
        "batter": current_pitch['matchup']['batter']['id'], #current_pitch['matchup']['batter']['id']
        "balls": current_pitch['count']['balls'], #current_pitch['count']['balls']
        "strikes": current_pitch['count']['strikes'], #current_pitch['count']['strikes']
        "game_year": 2026, #game_data['gameData']['datetime']['year']
        "outs_when_up": current_pitch['count']['outs'], #current_pitch['matchup']['outs']
        "inning": current_pitch['about']['inning'], #current_pitch['about']['inning']
        "at_bat_number": current_pitch['atBatIndex'], #current_pitch['atBatIndex']
        "bat_score": bat_score, #current_pitch['matchup']['batScore']
        "fld_score": fld_score, #current_pitch['matchup']['fldScore']
        "game_type": 'R', #game['game_type']
        "stand": current_pitch['matchup']['batSide']['code'], #current_pitch['matchup']['batSide']['code']
        "p_throws": current_pitch['matchup']['pitchHand']['code'], #current_pitch['matchup']['pitchHand']['code']
        "if_fielding_alignment": "standard",
        "of_fielding_alignment": "standard",
    }])
    return df