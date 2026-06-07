from sklearn import set_config
from sklearn.metrics import log_loss

from .pipeline import build_full_pipeline
from .data_loader import load_data

import wandb

import joblib
import math

from sklearn.calibration import CalibratedClassifierCV
import pandas as pd
# set this globally so that sklean always outputs in pandas df format
set_config(transform_output="pandas")

def train(config):

    X_train, X_test, X_val, y_train, y_test, y_val, labels = load_data()
    

    base_pipeline = build_full_pipeline(config)

    # Fit base model
    base_pipeline.fit(X_train, y_train)
    pd.set_option("display.max_columns", None)
    print(f'Xtrain first col: {X_train.head(1)}')

    # # Wrap in calibrator using validation set
    # calibrated_model = CalibratedClassifierCV(
    #     base_pipeline,
    #     method="sigmoid",   # or "isotonic"
    #     cv="prefit"         # IMPORTANT
    # )

    # calibrated_model.fit(X_val, y_val)

    preds = base_pipeline.predict_proba(X_test)

    loss = log_loss(y_test, preds)
    print(f"Log Loss: {loss}")

    return base_pipeline, {"log_loss": loss, "labels":labels}

def promote_best_model(metadata, logged_model_artifact, model_name="pitch-odds-model"):
    current_loss = metadata.get("log_loss", 0)
    ENTITY = wandb.run.entity
    PROJECT = wandb.run.project
    api = wandb.Api()

    try:
        prod_artifact = api.artifact(f"{ENTITY}/{PROJECT}/{model_name}:production")
        prod_loss = prod_artifact.metadata.get("log_loss", 0)
    except wandb.CommError:
        prod_loss = math.inf

    if current_loss < prod_loss:
        print(f"Promoting model! Log Loss {current_loss:.4f} < {prod_loss:.4f}")

        logged_model_artifact.aliases.append("production")
        logged_model_artifact.save()

        print("Model promoted to :production")

    else:
        print(f"Model not better than current production (Log Loss {prod_loss:.4f}). No promotion.")


if __name__ == "__main__":

    wandb.init(
        project='money-ball',
        config={
            'MODEL_TYPE': 'XGBoost',
            'objective':'multi:softprob', 
            'n_estimators':100,           # Set higher if using early stopping
            'max_depth':5, 
            'learning_rate':0.1,           # Lower learning rate often yields better probabilities
            'random_state':42,
            'tree_method':'hist',          # Faster training for large MLB datasets
            'early_stopping_rounds':None     
        }
    )

    config = wandb.config

    pipeline, metadata = train(config)

    joblib.dump(pipeline, 'model.pkl')
    model_artifact = wandb.Artifact(name="pitch-odds-model", type="model", metadata=metadata)
    model_artifact.add_file('model.pkl')
    

    logged_model_artifact = wandb.log_artifact(model_artifact)
    logged_model_artifact.wait()

    promote_best_model(metadata, logged_model_artifact)

    wandb.finish()



    