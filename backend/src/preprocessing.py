from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer

from .transformers import PlayerEBRateTransformer, PlayerClusterDistanceTransformer


def eb_shrinkage_pipeline():
    # create sklearn pipeline to transform the data using empirical bayes shrinkage
    eb_pipeline = Pipeline([
        ("pitcher_strike_eb", PlayerEBRateTransformer(
            player_col="pitcher",
            success_col="is_strike",
            # total_col="pitch_id",
            output_col="pitcher_strike_rate_eb"
        )),
        ("pitcher_ball_eb", PlayerEBRateTransformer(
            player_col="pitcher",
            success_col="is_ball",
            # total_col="pitch_id",
            output_col="pitcher_ball_rate_eb"
        )),
        ("pitcher_hit_eb", PlayerEBRateTransformer(
            player_col="pitcher",
            success_col="is_hit",
            # total_col="pitch_id",
            output_col="pitcher_hit_rate_eb"
        )),
        ("batter_hit_eb", PlayerEBRateTransformer(
            player_col="batter",
            success_col="is_hit",
            # total_col="pitch_id",
            output_col="batter_hit_rate_eb"
        )),
        ("batter_strike_eb", PlayerEBRateTransformer(
            player_col="batter",
            success_col="is_strike",
            # total_col="pitch_id",
            output_col="batter_strike_rate_eb"
        )),
        ("batter_ball_eb", PlayerEBRateTransformer(
            player_col="batter",
            success_col="is_ball",
            # total_col="pitch_id",
            output_col="batter_ball_rate_eb"
        )),
        # ("pitcher_ff_rate_eb", PlayerEBRateTransformer(
        #     player_col="pitcher",
        #     success_col="is_ff",
        #     # total_col="pitch_id",
        #     output_col="pitcher_ff_rate_eb"
        # )),
        # ("pitcher_ch_rate_eb", PlayerEBRateTransformer(
        # ("pitcher_sl_rate_eb", PlayerEBRateTransformer(
        #     player_col="pitcher",
        #     success_col="is_sl",
        #     # total_col="pitch_id",
        #     output_col="pitcher_sl_rate_eb"
        # )),
        # ("pitcher_si_rate_eb", PlayerEBRateTransformer(
        #     player_col="pitcher",
        #     success_col="is_si",
        #     # total_col="pitch_id",
        #     output_col="pitcher_si_rate_eb"
        # )),
        # ("pitcher_fc_rate_eb", PlayerEBRateTransformer(
        #     player_col="pitcher",
        #     success_col="is_fc",
        #     # total_col="pitch_id",
        #     output_col="pitcher_fc_rate_eb"
        # )),
        # ("pitcher_st_rate_eb", PlayerEBRateTransformer(
        #     player_col="pitcher",
        #     success_col="is_st",
        #     # total_col="pitch_id",
        #     output_col="pitcher_st_rate_eb"
        # )),
        # ("pitcher_fs_rate_eb", PlayerEBRateTransformer(
        #     player_col="pitcher",
        #     success_col="is_fs",
        #     # total_col="pitch_id",
        #     output_col="pitcher_fs_rate_eb"
        # )),
        # ("pitcher_cu_rate_eb", PlayerEBRateTransformer(
        #     player_col="pitcher",
        #     success_col="is_cu",
        #     # total_col="pitch_id",
        #     output_col="pitcher_cu_rate_eb"
        # )),
        # ("pitcher_kc_rate_eb", PlayerEBRateTransformer(
        #     player_col="pitcher",
        #     success_col="is_kc",
        #     # total_col="pitch_id",
        #     output_col="pitcher_kc_rate_eb"
        # )),            player_col="pitcher",
        #     success_col="is_ch",
        #     # total_col="pitch_id",
        #     output_col="pitcher_ch_rate_eb"
        # )),

    ])

    return eb_pipeline

def kmeans_pipeline():
    
    kmeans_pipeline = Pipeline([
    ('pitcher_archetype', PlayerClusterDistanceTransformer(
        player_col='pitcher',
        cluster_cols=['pitcher_strike_rate_eb', 'pitcher_ball_rate_eb', 'pitcher_hit_rate_eb'],
        prefix='pitcher_cluster'
    )),
    ('batter_archetype', PlayerClusterDistanceTransformer(
        player_col='batter',
        cluster_cols=['batter_strike_rate_eb', 'batter_ball_rate_eb', 'batter_hit_rate_eb'],
        prefix='batter_cluster'
    )),
])
    return kmeans_pipeline


# 1. Feature Creator (The "Count" String)
def make_count_feature(X):
    X = X.copy()
    X['count'] = X['balls'].astype(str) + "-" + X['strikes'].astype(str)
    return X

count_gen = FunctionTransformer(make_count_feature)

# 2. Categorical Mini-Pipeline
categorical_features=[
    'game_type',
    'stand',
    'p_throws',
    'if_fielding_alignment',
    'of_fielding_alignment'
]

rate_features = [
    'pitcher_strike_rate_eb', 
    'pitcher_ball_rate_eb', 
    'pitcher_hit_rate_eb',
    'batter_strike_rate_eb', 
    'batter_ball_rate_eb', 
    'batter_hit_rate_eb'
]

base_numeric = [
    'game_year',
    'outs_when_up',
    'inning',
    'at_bat_number',
    'bat_score',
    'fld_score'
]

cat_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
    ("encoder", OneHotEncoder(handle_unknown='ignore', sparse_output=False))
])

def build_preprocessing_pipeline():
    pipeline = Pipeline([
        ("eb_logic", eb_shrinkage_pipeline()),        # EB rate features
        ("count_step", count_gen)        # Adds 'count' string
        #("kmeans_logic", kmeans_pipeline()) # Adds cluster distance columns
    ])

    return pipeline


def build_column_transformer():
    column_processor = ColumnTransformer(
        transformers=[
            ("base", "passthrough", base_numeric),
            ("rates", "passthrough", rate_features),
            # ("kmeans", "passthrough",
            #     lambda df: df.columns[df.columns.str.contains("_cluster_center_")]
            # ),
            ("cat_encoding", cat_pipeline, categorical_features),
            ("count_ohe",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                ["count"]
            )
        ],
        remainder="drop"
    )

    column_processor.set_output(transform="pandas")

    return column_processor





