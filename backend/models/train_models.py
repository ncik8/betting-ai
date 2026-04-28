"""
ML Training Pipeline for Premier League Predictions
Trains models on historical data from football-data.co.uk
Uses sklearn (no xgboost dependency)
"""

import os
import glob
import pandas as pd
import numpy as np
import pickle
from pathlib import Path
from datetime import datetime
import json

# ML imports
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
MODELS_DIR = Path(__file__).parent.parent / "models" / "trained"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Season mapping
SEASON_FILES = {
    "9596": "E0_9596.csv", "9900": "E0_9900.csv",
    "0001": "E0_0001.csv", "0102": "E0_0102.csv", "0203": "E0_0203.csv",
    "0304": "E0_0304.csv", "0405": "E0_0405.csv", "0506": "E0_0506.csv",
    "0607": "E0_0607.csv", "0708": "E0_0708.csv", "0809": "E0_0809.csv",
    "0910": "E0_0910.csv", "1011": "E0_1011.csv", "1112": "E0_1112.csv",
    "1213": "E0_1213.csv", "1314": "E0_1314.csv", "1415": "E0_1415.csv",
    "1516": "E0_1516.csv", "1617": "E0_1617.csv", "1718": "E0_1718.csv",
    "1819": "E0_1819.csv", "1920": "E0_1920.csv", "2021": "E0_2021.csv",
    "2122": "E0_2122.csv", "2223": "E0_2223.csv", "2324": "E0_2324.csv",
}


def load_all_data() -> pd.DataFrame:
    """Load all CSV files and combine into single DataFrame"""
    all_dfs = []
    
    for season, filename in SEASON_FILES.items():
        filepath = DATA_DIR / filename
        if filepath.exists():
            try:
                df = pd.read_csv(filepath, on_bad_lines='skip')
                df["Season"] = season
                all_dfs.append(df)
                print(f"Loaded {filename}: {len(df)} matches")
            except Exception as e:
                print(f"Skipping {filename}: {e}")
    
    combined = pd.concat(all_dfs, ignore_index=True)
    print(f"\nTotal matches: {len(combined)}")
    return combined


def parse_date(df: pd.DataFrame) -> pd.DataFrame:
    """Parse date column to datetime"""
    df["Date"] = pd.to_datetime(df["Date"], format="%d/%m/%Y", errors="coerce")
    return df


def create_features(df: pd.DataFrame) -> tuple:
    """
    Create features for ML models from raw match data.
    Features are designed to predict BEFORE the match (no in-play data).
    """
    df = df.copy()
    
    # ---- Team Encoders ----
    all_teams = pd.concat([df["HomeTeam"], df["AwayTeam"]]).unique()
    team_encoder = LabelEncoder()
    team_encoder.fit(all_teams)
    df["HomeTeamEnc"] = team_encoder.transform(df["HomeTeam"])
    df["AwayTeamEnc"] = team_encoder.transform(df["AwayTeam"])
    
    # Only keep rows that have FTR (match result)
    df = df.dropna(subset=["FTR"])
    
    # Check for required columns
    required_cols = ["FTHG", "FTAG", "HC", "AC", "HY", "AY", "HS", "AS"]
    for col in required_cols:
        if col not in df.columns:
            df[col] = 0  # Fill missing with 0
    
    # ---- Target Variables ----
    # 1X2: H=Home win, D=Draw, A=Away win
    df["Target_1X2"] = df["FTR"]
    
    # Over/Under 2.5
    df["TotalGoals"] = df["FTHG"].fillna(0) + df["FTAG"].fillna(0)
    df["Target_Over2.5"] = (df["TotalGoals"] > 2.5).astype(int)
    
    # BTTS
    df["Target_BTTS"] = ((df["FTHG"].fillna(0) > 0) & (df["FTAG"].fillna(0) > 0)).astype(int)
    
    # ---- Historical Team Stats ----
    home_stats = df.groupby("HomeTeam").agg({
        "FTHG": ["mean", "std"],
        "FTAG": ["mean"],
        "HC": ["mean"],
        "HY": ["mean"],
        "HS": ["mean"],
    }).reset_index()
    home_stats.columns = ["Team", "HomeGoalsAvg", "HomeGoalsStd", "HomeConcededAvg", "HomeCornersAvg", "HomeYellowsAvg", "HomeShotsAvg"]
    
    away_stats = df.groupby("AwayTeam").agg({
        "FTAG": ["mean", "std"],
        "FTHG": ["mean"],
        "AC": ["mean"],
        "AY": ["mean"],
        "AS": ["mean"],
    }).reset_index()
    away_stats.columns = ["Team", "AwayGoalsAvg", "AwayGoalsStd", "AwayConcededAvg", "AwayCornersAvg", "AwayYellowsAvg", "AwayShotsAvg"]
    
    df = df.merge(home_stats, left_on="HomeTeam", right_on="Team", how="left")
    df = df.merge(away_stats, left_on="AwayTeam", right_on="Team", how="left", suffixes=("_home", "_away"))
    
    # Fill NaN with league averages
    for col in df.columns:
        if df[col].dtype in [np.float64, np.int64]:
            df[col] = df[col].fillna(df[col].mean())
    
    # ---- Feature Set ----
    # Only use features that actually exist
    possible_features = [
        "HomeTeamEnc", "AwayTeamEnc",
        "HomeGoalsAvg_home", "HomeGoalsStd_home", "HomeConcededAvg_home",
        "AwayGoalsAvg_away", "AwayGoalsStd_away", "AwayConcededAvg_away",
        "HomeCornersAvg_home", "AwayCornersAvg_away",
        "HomeYellowsAvg_home", "AwayYellowsAvg_away",
        "HomeShotsAvg_home", "AwayShotsAvg_away",
    ]
    feature_cols = [f for f in possible_features if f in df.columns]
    
    df = df.dropna(subset=["FTR"])
    
    print(f"Features created. Valid samples: {len(df)}")
    
    return df, feature_cols, team_encoder


def train_1x2_model(X_train, X_test, y_train, y_test):
    """Train 1X2 (match outcome) model"""
    print("\n--- Training 1X2 Model ---")
    
    model = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    print(f"1X2 Accuracy: {acc:.3f}")
    print(classification_report(y_test, y_pred))
    
    return model


def train_over_under_model(X_train, X_test, y_train, y_test):
    """Train Over/Under 2.5 goals model"""
    print("\n--- Training Over/Under 2.5 Model ---")
    
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    print(f"Over/Under 2.5 Accuracy: {acc:.3f}")
    
    return model


def train_btts_model(X_train, X_test, y_train, y_test):
    """Train Both Teams To Score model"""
    print("\n--- Training BTTS Model ---")
    
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    print(f"BTTS Accuracy: {acc:.3f}")
    
    return model


def train_corners_model(df):
    """Train corners prediction model"""
    print("\n--- Training Corners Model ---")
    
    required = ["HC", "AC", "HomeTeamEnc", "AwayTeamEnc", "HomeCornersAvg_home", "AwayCornersAvg_away"]
    df_corners = df.dropna(subset=["HC", "AC"])
    
    if len(df_corners) < 100:
        print("Not enough data for corners model")
        return None
    
    features = [f for f in ["HomeTeamEnc", "AwayTeamEnc", "HomeCornersAvg_home", "AwayCornersAvg_away"] if f in df_corners.columns]
    if len(features) < 2:
        print("Not enough features for corners model")
        return None
        
    X = df_corners[features]
    y = df_corners["HC"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    mae = mean_absolute_error(y_test, y_pred)
    print(f"Corners Model MAE: {mae:.2f}")
    
    return model


def train_cards_model(df):
    """Train cards prediction model"""
    print("\n--- Training Cards Model ---")
    
    df_cards = df.copy()
    df_cards["TotalCards"] = df_cards["HY"].fillna(0) + df_cards["AY"].fillna(0) + 2 * (df_cards.get("HR", 0).fillna(0) + df_cards.get("AR", 0).fillna(0))
    
    if len(df_cards) < 100:
        print("Not enough data for cards model")
        return None
    
    features = [f for f in ["HomeTeamEnc", "AwayTeamEnc", "HomeYellowsAvg_home", "AwayYellowsAvg_away"] if f in df_cards.columns]
    if len(features) < 2:
        print("Not enough features for cards model")
        return None
    
    X = df_cards[features]
    y = df_cards["TotalCards"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    mae = mean_absolute_error(y_test, y_pred)
    print(f"Cards Model MAE: {mae:.2f}")
    
    return model


def train_ht_ft_model(df):
    """Train Half Time / Full Time model"""
    print("\n--- Training HT/FT Model ---")
    
    df_htft = df.dropna(subset=["HTR", "FTR"]).copy()
    
    if len(df_htft) < 100:
        print("Not enough data for HT/FT model")
        return None
    
    df_htft["Target_HTFT"] = df_htft["HTR"] + df_htft["FTR"]
    
    features = [f for f in ["HomeTeamEnc", "AwayTeamEnc", "HomeGoalsAvg_home", "AwayGoalsAvg_away",
                "HomeConcededAvg_home", "AwayConcededAvg_away"] if f in df_htft.columns]
    if len(features) < 2:
        print("Not enough features for HT/FT model")
        return None
    
    X = df_htft[features]
    y = df_htft["Target_HTFT"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    print(f"HT/FT Accuracy: {acc:.3f}")
    
    return model


def train_asian_handicap_model(df):
    """Train Asian Handicap model based on historical scorelines"""
    print("\n--- Training Asian Handicap Model ---")
    
    df_ah = df.dropna(subset=["FTHG", "FTAG"]).copy()
    
    if len(df_ah) < 100:
        print("Not enough data for AH model")
        return None
    
    df_ah["GoalDiff"] = df_ah["FTHG"].fillna(0) - df_ah["FTAG"].fillna(0)
    
    features = [f for f in ["HomeTeamEnc", "AwayTeamEnc", "HomeGoalsAvg_home", "AwayGoalsAvg_away",
                "HomeConcededAvg_home", "AwayConcededAvg_away"] if f in df_ah.columns]
    if len(features) < 2:
        print("Not enough features for AH model")
        return None
    
    X = df_ah[features]
    y = df_ah["GoalDiff"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    mae = mean_absolute_error(y_test, y_pred)
    print(f"Asian Handicap Model MAE: {mae:.2f}")
    
    return model


def calculate_odds_implied_probability(df):
    """Calculate what odds the market implies for each outcome"""
    df_odds = df.dropna(subset=["B365H", "B365D", "B365A"])
    
    if len(df_odds) < 100:
        return None
    
    df_odds = df_odds.copy()
    df_odds["ImpliedHomeWin"] = 1 / df_odds["B365H"]
    df_odds["ImpliedDraw"] = 1 / df_odds["B365D"]
    df_odds["ImpliedAwayWin"] = 1 / df_odds["B365A"]
    
    total_implied = df_odds["ImpliedHomeWin"] + df_odds["ImpliedDraw"] + df_odds["ImpliedAwayWin"]
    df_odds["MarketProb_HomeWin"] = df_odds["ImpliedHomeWin"] / total_implied
    df_odds["MarketProb_Draw"] = df_odds["ImpliedDraw"] / total_implied
    df_odds["MarketProb_AwayWin"] = df_odds["ImpliedAwayWin"] / total_implied
    
    print(f"\nMarket Implied Probabilities (avg):")
    print(f"  Home Win: {df_odds['MarketProb_HomeWin'].mean():.1%}")
    print(f"  Draw: {df_odds['MarketProb_Draw'].mean():.1%}")
    print(f"  Away Win: {df_odds['MarketProb_AwayWin'].mean():.1%}")
    
    return {
        "B365H_avg": float(df_odds["B365H"].mean()),
        "B365D_avg": float(df_odds["B365D"].mean()),
        "B365A_avg": float(df_odds["B365A"].mean()),
        "MarketProb_HomeWin": float(df_odds["MarketProb_HomeWin"].mean()),
        "MarketProb_Draw": float(df_odds["MarketProb_Draw"].mean()),
        "MarketProb_AwayWin": float(df_odds["MarketProb_AwayWin"].mean()),
    }


def save_models(models_dict: dict, team_encoder, feature_cols: list, stats: dict, odds_analysis: dict):
    """Save all trained models to disk"""
    
    model_package = {
        "models": models_dict,
        "team_encoder": team_encoder,
        "feature_cols": feature_cols,
        "stats": stats,
        "odds_analysis": odds_analysis,
        "trained_at": datetime.now().isoformat(),
        "total_matches": len(SEASON_FILES),
    }
    
    output_path = MODELS_DIR / "premier_league_models.pkl"
    with open(output_path, "wb") as f:
        pickle.dump(model_package, f)
    
    print(f"\n✅ Models saved to: {output_path}")
    
    # Save individual market models
    for market, model in models_dict.items():
        if model is not None:
            single_path = MODELS_DIR / f"model_{market}.pkl"
            with open(single_path, "wb") as f:
                pickle.dump(model, f)
            print(f"   Saved: {single_path.name}")
    
    # Save stats as JSON
    stats["trained_at"] = datetime.now().isoformat()
    stats_path = MODELS_DIR / "training_stats.json"
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2, default=str)
    
    print(f"✅ Stats saved to: {stats_path}")


def main():
    print("=" * 60)
    print("Premier League ML Training Pipeline")
    print("=" * 60)
    
    # 1. Load data
    print("\n[1/5] Loading data...")
    df = load_all_data()
    df = parse_date(df)
    
    # 2. Create features
    print("\n[2/5] Creating features...")
    df, feature_cols, team_encoder = create_features(df)
    
    # 3. Train/Test split
    print("\n[3/5] Preparing train/test split...")
    X = df[feature_cols]
    y_1x2 = df["Target_1X2"]
    y_ou = df["Target_Over2.5"]
    y_btts = df["Target_BTTS"]
    
    X_train, X_test, y_1x2_train, y_1x2_test = train_test_split(X, y_1x2, test_size=0.2, random_state=42)
    _, _, y_ou_train, y_ou_test = train_test_split(X, y_ou, test_size=0.2, random_state=42)
    _, _, y_btts_train, y_btts_test = train_test_split(X, y_btts, test_size=0.2, random_state=42)
    
    # 4. Train models
    print("\n[4/5] Training models...")
    models = {}
    
    models["1x2"] = train_1x2_model(X_train, X_test, y_1x2_train, y_1x2_test)
    models["over_under"] = train_over_under_model(X_train, X_test, y_ou_train, y_ou_test)
    models["btts"] = train_btts_model(X_train, X_test, y_btts_train, y_btts_test)
    models["corners"] = train_corners_model(df)
    models["cards"] = train_cards_model(df)
    models["ht_ft"] = train_ht_ft_model(df)
    models["asian_handicap"] = train_asian_handicap_model(df)
    
    # 5. Analyze market odds
    print("\n[5/5] Analyzing market odds...")
    odds_analysis = calculate_odds_implied_probability(df)
    
    stats = {
        "feature_cols": feature_cols,
        "total_matches": len(df),
        "seasons": list(SEASON_FILES.keys()),
    }
    
    save_models(models, team_encoder, feature_cols, stats, odds_analysis)
    
    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
