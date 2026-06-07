from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import davies_bouldin_score

import scipy.optimize
from scipy.stats import beta, norm, binom
from scipy.special import betaln

import numpy as np

import pandas as pd
from sklearn import set_config
set_config(transform_output="pandas")


class BetaBinomialPrior:
    # fit will take in y (success col) and n (total col)
    def fit(self, y, n):
        mu = y.sum()/n.sum()

        # create negative likelihood function
        def nll(kappa):

            alpha = mu * kappa
            beta = (1-mu)*kappa

            # calculate joint beta-binomial marginal likelihood
            loglik = np.sum(betaln(y+alpha,n-y+beta)-betaln(alpha,beta))
            
            return -loglik # we minimize later, make negative to do so

        res = scipy.optimize.minimize(nll, x0 = 10, bounds=[(0.01,None)])
        kappa_hat = res.x[0]
        self.alpha_ = mu * kappa_hat
        self.beta_ = (1-mu)*kappa_hat
        self.mu_ = mu

        return self

    def posterior_mean(self, y, n):
        return (y + self.alpha_) / (n + self.alpha_ + self.beta_)
    

# create sklearn fit transform pipeline which leverages BetaBinomialPrior class
class PlayerEBRateTransformer(BaseEstimator, TransformerMixin):

    # init vars
    def __init__(self, player_col, success_col, output_col):
        self.player_col = player_col
        self.success_col = success_col
        self.output_col = output_col
    
    # fit prior to data, calculate posteriorsT
    def fit(self, X, y=None):
        # group by player id column, get success and totals for each player
        grouped = (
            X.groupby(self.player_col)
            .agg(
                y = (self.success_col, "sum"),
                n = (self.success_col, "size")
            )
        )
        
        # calculate prior using neg log likelihood method in BetaBinomialPrior().fit()
        # provide successes and failure values for each player to make this estimation
        self.prior_ = BetaBinomialPrior().fit(
            grouped['y'].values,
            grouped['n'].values
        )

        # calculate posterior mean (new metric estimate) for each player in pivot
        grouped[self.output_col] = self.prior_.posterior_mean(
            grouped['y'].values,
            grouped['n'].values
        )

        # create lookup table and default values for pitchers
        self.lookup_ = grouped[self.output_col].to_dict()
        self.default_ = self.prior_.mu_

        return self
    
    # create transform funciton to set column values to lookup values or default if not present
    def transform(self, X):
        X = X.copy()
        X[self.output_col] = (
            X[self.player_col]
            .map(self.lookup_)
            .fillna(self.default_) # might need to fix this step to fill NA with a calculated shrunk rate using alpha and beta?
        )
        return X

# class for creating kmeans clustering using provided features
class PlayerClusterDistanceTransformer(BaseEstimator, TransformerMixin):
    def __init__(self, player_col, cluster_cols, max_k=10, prefix="cluster"):
        self.player_col = player_col
        self.cluster_cols = cluster_cols
        self.max_k = max_k
        self.prefix = prefix

        self.scaler_ = StandardScaler()
        self.kmeans_ = None
        self.best_k_ = None
        self.distance_map_ = None
        self.dist_cols_ = None

    def fit(self, X, y=None):
        # One row per player
        X_unique = (
            X.groupby(self.player_col)[self.cluster_cols]
            .first()
            .dropna()
        )

        X_scaled = self.scaler_.fit_transform(X_unique)

        # Select best K via Davies-Bouldin
        ks = np.arange(2, self.max_k + 1)
        db_scores = []

        for k in ks:
            km = KMeans(n_clusters=k, n_init=10, random_state=42)
            labels = km.fit_predict(X_scaled)
            db_scores.append(davies_bouldin_score(X_scaled, labels))

        self.best_k_ = ks[np.argmin(db_scores)]

        self.kmeans_ = KMeans(
            n_clusters=self.best_k_,
            n_init=10,
            random_state=42
        ).fit(X_scaled)

        # Compute distances
        distances = self.kmeans_.transform(X_scaled)

        self.dist_cols_ = [
            f"{self.prefix}_center_{i}"
            for i in range(self.best_k_)
        ]

        # Store as mapping instead of DataFrame
        self.distance_map_ = dict(
            zip(X_unique.index, distances)
        )

        return self

    def transform(self, X):
        X_out = X.copy()

        # Map existing players
        def get_dist(player):
            return self.distance_map_.get(player)

        dist_array = X_out[self.player_col].map(get_dist)

        # Handle unseen players
        unseen_mask = dist_array.isna()

        if unseen_mask.any():
            unseen_players = (
                X_out.loc[unseen_mask, [self.player_col] + self.cluster_cols]
                .drop_duplicates()
            )

            scaled = self.scaler_.transform(unseen_players[self.cluster_cols])
            dists = self.kmeans_.transform(scaled)

            for player, dist in zip(unseen_players[self.player_col], dists):
                self.distance_map_[player] = dist

            dist_array = X_out[self.player_col].map(get_dist)

        # Expand into columns
        dist_matrix = np.vstack(dist_array.values)
        dist_df = pd.DataFrame(
            dist_matrix,
            columns=self.dist_cols_,
            index=X_out.index
        )

        return pd.concat([X_out, dist_df], axis=1)
    

    def get_feature_names_out(self, input_features=None):
        if self.dist_cols_ is None:
            raise RuntimeError("Transformer must be fitted before getting feature names.")
        return np.array(self.dist_cols_)