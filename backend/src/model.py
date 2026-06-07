import xgboost as xgb

def build_model(config):
    return xgb.XGBClassifier(
        objective=config.objective, 
        n_estimators=config.n_estimators,           # Set higher if using early stopping
        max_depth=config.max_depth, 
        learning_rate=config.learning_rate,           # Lower learning rate often yields better probabilities
        random_state=config.random_state,
        tree_method=config.tree_method,          # Faster training for large MLB datasets
        early_stopping_rounds=config.early_stopping_rounds
    )