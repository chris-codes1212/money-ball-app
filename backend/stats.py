import utils

def get_player_stats(pipeline, play_data):
        df = utils.preprocess_play_data(play_data)  # You would need to implement this function based on your model's expected input
        feature_eng = pipeline.named_steps["feature_engineering"]
        X_features = feature_eng.transform(df)
        engineered_stats = X_features[[
            "pitcher_strike_rate_eb",
            "pitcher_ball_rate_eb",
            "pitcher_hit_rate_eb",
            "batter_strike_rate_eb",
            "batter_ball_rate_eb",
            "batter_hit_rate_eb"
        ]].iloc[0].to_dict()

        player_stats = {
            "batter": {
                "strike_rate": float(round(engineered_stats["batter_strike_rate_eb"]*100, 2)),
                "ball_rate": float(round(engineered_stats["batter_ball_rate_eb"]*100, 2)),
                "hit_rate": float(round(engineered_stats["batter_hit_rate_eb"]*100, 2)),
            },
            "pitcher": {
                "strike_rate": float(round(engineered_stats["pitcher_strike_rate_eb"]*100, 2)),
                "ball_rate": float(round(engineered_stats["pitcher_ball_rate_eb"]*100, 2)),
                "hit_rate": float(round(engineered_stats["pitcher_hit_rate_eb"]*100, 2)),
            }
        }

        return player_stats
