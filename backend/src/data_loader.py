import pandas as pd
import pybaseball
from pybaseball import statcast

from sklearn.model_selection import train_test_split


def map_outcome_coarse(row):
    strikes = ['called_strike', 'swinging_strike', 'swinging_strike_blocked', 'foul_tip', 'missed_bunt', 'bunt_foul_tip', 'automatic_strike']
    balls = ['pitchout', 'ball', 'blocked_ball', 'intent_ball', 'automatic_ball']

    if row["description"] in balls:
        return "ball"
    
    if  row["description"] in strikes:
        return "strike"
    
    if row["description"] == "foul" and row['strikes'] == 2:
        return "non-strike foul"

    if row["description"] == "foul_bunt" and row['strikes'] == 2:
        return "non-strike foul"
    
    if row["description"] == "foul_pitchout" and row['strikes'] == 2:
        return "non-strike foul"
    
    if row["description"] == "foul" and row['strikes'] < 2:
        return "strike"
    
    if row["description"] == "foul_pitchout" and row['strikes'] < 2:
        return "strike"
    
    if row["description"] == "foul_bunt" and row['strikes'] < 2:
        return "strike"
    
    hits = ['hit_into_play', 'hit_by_pitch']
    if row['description'] in hits:
        return "hit"



def load_data():
    # load data as df from pybaseball
    pybaseball.cache.enable()
    df = statcast(start_dt='2023-06-24', end_dt='2025-05-24')

    # copy df for safety, keep original df in tact
    df_copy = df.copy()

    # create outcome variable
    df_copy['outcome_coarse'] = df_copy.apply(map_outcome_coarse, axis=1)
    df_copy = df_copy.reset_index(drop=True)

    # create new binary variables for calculating rates later
    df_copy['is_strike'] = df_copy['outcome_coarse'].isin(['strike'])
    df_copy['is_hit'] = df_copy['outcome_coarse'].isin(['hit'])
    df_copy['is_ball'] = df_copy['outcome_coarse'].isin(['ball'])
    df_copy['is_foul'] = df_copy['outcome_coarse'].isin(['non-strike foul'])


    train_df, test_df= train_test_split(
        df_copy,
        test_size=0.2,
        random_state=42)

    train_df, val_df = train_test_split(
        train_df, 
        test_size=0.2,
        random_state=42)
    
    mapping = {'strike': 0, 'ball': 1, 'hit': 2, 'non-strike foul': 3}
    labels = ['strike', 'ball', 'hit', 'non-strike foul']

    y_train = train_df["outcome_coarse"].map(mapping)
    y_test = test_df["outcome_coarse"].map(mapping)
    y_val = val_df["outcome_coarse"].map(mapping)

    X_train = train_df.drop(columns=["outcome_coarse"])
    X_test = test_df.drop(columns=["outcome_coarse"])
    X_val = val_df.drop(columns=["outcome_coarse"])

    return X_train, X_test, X_val, y_train, y_test, y_val, labels
