import logging
import pandas as pd
import utils

def get_pitch_probs(play_data, model=None, labels=None):

    # Placeholder function to calculate pitch odds based on the current play data, replace with actual implementation
    # You would typically preprocess the play_data to extract relevant features and then pass it through your model to get predictions
    if model is not None:
        # Example of how you might preprocess play_data and get predictions from the model
        df = utils.preprocess_play_data(play_data)  # You would need to implement this function based on your model's expected input
        probs = model.predict_proba(df)[0]  # Get predicted probabilities for each class
        return dict(zip(labels, probs)) # Return a dictionary mapping labels to their predicted probabilities

    else:
        logging.warning("Model is not loaded. Returning placeholder odds.")
        return {
            "strike": 0.45,
            "ball": 0.35,
            "hit": 0.20,
            "non-strike foul": 0.05
        }

# def probs_to_ints(probs):
#     # Step 1: scale
#     scaled = [p * 100 for p in probs]

#     # Step 2: take floors
#     floored = [math.floor(x) for x in scaled]

#     # Step 3: compute remainder
#     remainder = 100 - sum(floored)

#     # Step 4: distribute remaining points to largest decimals
#     decimals = [(i, scaled[i] - floored[i]) for i in range(len(probs))]
#     decimals.sort(key=lambda x: x[1], reverse=True)

#     for i in range(remainder):
#         idx = decimals[i][0]
#         floored[idx] += 1

#     return floored

def probs_with_vig(probs):
    total_prob = sum(probs.values())
    vig_factor = 1.07  # vig factor, adjust as needed
    adjusted_probs = {k: (v / total_prob) * vig_factor for k, v in probs.items()}
    return adjusted_probs

def get_pitch_odds(play_data, model=None, labels=None):
    probs = get_pitch_probs(play_data, model, labels)
    vig_probs = probs_with_vig(probs)
    
    if play_data['count']['strikes'] == 3 or play_data['count']['balls'] == 4:
        odds = {k: 0.0 for k in vig_probs.keys()}  # If the count is already at 3 strikes or 4 balls, the odds are not applicable
    
    else:
    
        odds = {k: int(100*v / (1 - v)) if v > 0.5 else int(100*(1-v) / v) for k, v in vig_probs.items()} 
    
        if play_data['count']['strikes'] < 2:
            odds['non-strike foul'] = 0.0  # Assign a 0 probability to non-strike fouls when there are less than 2 strikes
    
 # Convert probabilities to odds
    return odds