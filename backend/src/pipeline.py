from sklearn.pipeline import Pipeline
from .preprocessing import build_preprocessing_pipeline, build_column_transformer
from .model import build_model

def build_full_pipeline(config):

    feature_pipeline = build_preprocessing_pipeline()

    column_processor = build_column_transformer()

    full_pipeline = Pipeline([
        ("feature_engineering", feature_pipeline),
        ("column_processing", column_processor),
        ("model", build_model(config))
    ])

    return full_pipeline
