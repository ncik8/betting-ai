"""
Prediction Service for Premier League
Uses trained ML models + current table data to generate predictions
"""

import os
import sys
import pickle
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Any

# Paths
MODELS_DIR = Path(__file__).parent / "trained"
DATA_DIR = Path(__file__).parent.parent.parent / "data"

# League table with form (updated May 2026 - season 2025/26)
LIVE_TABLE = {
    "Arsenal": {"pos": 1, "pts": 76, "gd": 41, "form": "WLLWW"},
    "Man City": {"pos": 2, "pts": 70, "gd": 37, "form": "DDWWW"},
    "Man United": {"pos": 3, "pts": 62, "gd": 14, "form": "WDLWW"},
    "Liverpool": {"pos": 4, "pts": 59, "gd": 13, "form": "DLWWW"},
    "Aston Villa": {"pos": 5, "pts": 58, "gd": 5, "form": "LWDWL"},
    "Bournemouth": {"pos": 6, "pts": 52, "gd": 2, "form": "DDWWD"},
    "Brentford": {"pos": 7, "pts": 51, "gd": 6, "form": "DDDLW"},
    "Brighton": {"pos": 8, "pts": 50, "gd": 7, "form": "WWDWL"},
    "Chelsea": {"pos": 9, "pts": 49, "gd": 5, "form": "WWDWW"},
    "Fulham": {"pos": 10, "pts": 49, "gd": 1, "form": "WDWDW"},
    "Palace": {"pos": 11, "pts": 46, "gd": 4, "form": "WWLWL"},
    "Everton": {"pos": 12, "pts": 46, "gd": -1, "form": "LDWDW"},
    "Newcastle": {"pos": 13, "pts": 44, "gd": 12, "form": "DWWWL"},
    "Nottm Forest": {"pos": 14, "pts": 42, "gd": 3, "form": "WDWWW"},
    "West Ham": {"pos": 15, "pts": 39, "gd": -9, "form": "WDWDL"},
    "Leicester": {"pos": 16, "pts": 36, "gd": -12, "form": "WWLDD"},
    "Tottenham": {"pos": 17, "pts": 35, "gd": -11, "form": "LDWDL"},
    "Southampton": {"pos": 18, "pts": 24, "gd": -31, "form": "LDLLL"},
    "Wolves": {"pos": 19, "pts": 20, "gd": -43, "form": "WLLDL"},
}


class PredictionService:
    def __init__(self):
        self.models = {}
        self.team_encoder = None
        self.feature_cols = []
        self.stats = {}
        self._load_models()
    
    def _load_models(self):
        """Load trained models from disk"""
        try:
            # Load the combined package
            package_path = MODELS_DIR / "premier_league_models.pkl"
            if package_path.exists():
                with open(package_path, "rb") as f:
                    package = pickle.load(f)
                    self.models = package.get("models", {})
                    self.team_encoder = package.get("team_encoder")
                    self.feature_cols = package.get("feature_cols", [])
                    self.stats = package.get("stats", {})
                    print(f"Loaded models from package: {list(self.models.keys())}")
            
            # Also try loading individual models
            model_files = [
                "model_1x2.pkl", "model_over_under.pkl", "model_btts.pkl",
                "model_corners.pkl", "model_cards.pkl", "model_ht_ft.pkl",
                "model_asian_handicap.pkl"
            ]
            for mf in model_files:
                name = mf.replace("model_", "").replace(".pkl", "")
                if name not in self.models:
                    path = MODELS_DIR / mf
                    if path.exists():
                        with open(path, "rb") as f:
                            self.models[name] = pickle.load(f)
                            print(f"Loaded individual model: {name}")
            
            print(f"Total models loaded: {list(self.models.keys())}")
        except Exception as e:
            print(f"Error loading models: {e}")
    
    def _get_team_encoding(self, team_name: str) -> Optional[int]:
        """Get numeric encoding for a team"""
        if self.team_encoder is None:
            return None
        try:
            return int(self.team_encoder.transform([team_name])[0])
        except:
            return None
    
    def _form_to_numeric(self, form: str) -> float:
        """Convert form string (WWLWD) to numeric score"""
        scores = {"W": 3, "D": 1, "L": 0}
        return sum(scores.get(c.upper(), 0) for c in form) / len(form) if form else 1.5
    
    def _get_table_features(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Extract features from current league table"""
        home = LIVE_TABLE.get(home_team, {"pos": 10, "pts": 40, "gd": 0, "form": "DDDDD"})
        away = LIVE_TABLE.get(away_team, {"pos": 10, "pts": 40, "gd": 0, "form": "DDDDD"})
        
        return {
            "home_pos": home["pos"],
            "away_pos": away["pos"],
            "home_pts": home["pts"],
            "away_pts": away["pts"],
            "home_gd": home["gd"],
            "away_gd": away["gd"],
            "home_form": self._form_to_numeric(home["form"]),
            "away_form": self._form_to_numeric(away["form"]),
            "pos_diff": home["pos"] - away["pos"],
            "form_diff": self._form_to_numeric(home["form"]) - self._form_to_numeric(away["form"]),
        }
    
    def _build_feature_vector(self, home_team: str, away_team: str) -> Optional[np.ndarray]:
        """Build feature vector for prediction"""
        if not self.feature_cols or not self.team_encoder:
            return None
        
        home_enc = self._get_team_encoding(home_team)
        away_enc = self._get_team_encoding(away_team)
        
        if home_enc is None or away_enc is None:
            # Fallback: create basic features
            table_feats = self._get_table_features(home_team, away_team)
            return np.array([[
                0, 0,  # Team encodings (placeholder)
                1.5, 0.5,  # Goals avg (placeholder)
                1.5, 0.5,  # Conceded avg (placeholder)
                table_feats["home_form"],
                table_feats["away_form"],
            ]])
        
        # Get historical stats from data
        home_stats = self._get_team_historical_stats(home_team)
        away_stats = self._get_team_historical_stats(away_team)
        table_feats = self._get_table_features(home_team, away_team)
        
        # Build vector matching training features
        features = []
        for col in self.feature_cols:
            if col == "HomeTeamEnc":
                features.append(home_enc)
            elif col == "AwayTeamEnc":
                features.append(away_enc)
            elif col == "HomeGoalsAvg_home":
                features.append(home_stats.get("goals_avg", 1.5))
            elif col == "AwayGoalsAvg_away":
                features.append(away_stats.get("goals_avg", 1.2))
            elif col == "HomeCornersAvg_home":
                features.append(home_stats.get("corners_avg", 5.5))
            elif col == "AwayCornersAvg_away":
                features.append(away_stats.get("corners_avg", 4.5))
            elif col == "HomeYellowsAvg_home":
                features.append(home_stats.get("yellows_avg", 1.5))
            elif col == "AwayYellowsAvg_away":
                features.append(away_stats.get("yellows_avg", 1.5))
            else:
                features.append(1.0)  # Default
        
        return np.array([features])
    
    def _get_team_historical_stats(self, team: str) -> Dict[str, float]:
        """Get historical stats for a team from training data"""
        # These are league averages from training - in production would compute from data
        return {
            "goals_avg": 1.5,
            "conceded_avg": 1.2,
            "corners_avg": 5.5,
            "yellows_avg": 1.5,
        }
    
    def predict_1x2(self, home_team: str, away_team: str) -> Dict[str, Any]:
        """Predict 1X2 (Home win / Draw / Away win)"""
        model = self.models.get("1x2")
        
        if model is None:
            # Fallback to form-based prediction
            return self._form_based_1x2(home_team, away_team)
        
        X = self._build_feature_vector(home_team, away_team)
        if X is None:
            return self._form_based_1x2(home_team, away_team)
        
        try:
            proba = model.predict_proba(X)[0]
            classes = model.classes_
            
            result = {}
            for i, cls in enumerate(classes):
                result[cls] = float(proba[i])
            
            return result
        except:
            return self._form_based_1x2(home_team, away_team)
    
    def _form_based_1x2(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Fallback: predict based on current form"""
        home = LIVE_TABLE.get(home_team, {"form": "DDDDD", "pos": 10})
        away = LIVE_TABLE.get(away_team, {"form": "DDDDD", "pos": 10})
        
        home_form_score = self._form_to_numeric(home["form"])
        away_form_score = self._form_to_numeric(away["form"])
        
        # Home advantage bonus
        home_advantage = 0.15
        
        # Calculate raw scores
        home_score = home_form_score + home_advantage
        away_score = away_form_score
        
        # Normalize to probabilities
        total = home_score + away_score + 1.0  # 1.0 for draw
        home_prob = home_score / total
        away_prob = away_score / total
        draw_prob = 1.0 / total
        
        return {
            "H": round(home_prob, 3),
            "D": round(draw_prob, 3),
            "A": round(away_prob, 3),
        }
    
    def predict_over_under(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Predict Over/Under 2.5 goals"""
        model = self.models.get("over_under")
        
        # Get table features for context
        table_feats = self._get_table_features(home_team, away_team)
        
        # Calculate expected goals based on form
        home_goals = 1.3 + (table_feats["home_form"] - 1.5) * 0.3
        away_goals = 1.0 + (table_feats["away_form"] - 1.5) * 0.3
        total_expected = max(0.5, home_goals + away_goals)
        
        over_prob = min(0.85, max(0.25, (total_expected - 1.5) / 3 + 0.45))
        
        return {
            "over_2.5": round(over_prob, 3),
            "under_2.5": round(1 - over_prob, 3),
            "expected_goals": round(total_expected, 1),
        }
    
    def predict_btts(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Predict Both Teams To Score"""
        model = self.models.get("btts")
        
        table_feats = self._get_table_features(home_team, away_team)
        
        # BTTS probability based on attacking strength and form
        home_attack = 1.3 + (table_feats["home_form"] - 1.5) * 0.2
        away_attack = 1.0 + (table_feats["away_form"] - 1.5) * 0.2
        
        # Both teams likely to score if both attacks > 1.0
        btts_prob = min(0.75, max(0.30, (home_attack + away_attack) / 3 + 0.25))
        
        return {
            "yes": round(btts_prob, 3),
            "no": round(1 - btts_prob, 3),
        }
    
    def predict_corners(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Predict total corners"""
        model = self.models.get("corners")
        
        table_feats = self._get_table_features(home_team, away_team)
        
        # Estimate based on historical data and form
        home_corners = 5.5 + (table_feats["home_form"] - 1.5) * 0.5
        away_corners = 4.5 + (table_feats["away_form"] - 1.5) * 0.4
        
        total = max(4, min(14, home_corners + away_corners))
        
        # Over 10.5 probability
        over_prob = min(0.70, max(0.30, (total - 8) / 8 + 0.35))
        
        return {
            "total": round(total, 1),
            "over_10.5": round(over_prob, 3),
            "under_10.5": round(1 - over_prob, 3),
            "home_corners": round(home_corners, 1),
            "away_corners": round(away_corners, 1),
        }
    
    def predict_cards(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Predict total cards"""
        # League average is around 3.5 cards per game
        table_feats = self._get_table_features(home_team, away_team)
        
        # Higher stakes = more cards typically
        pos_diff = abs(table_feats["pos_diff"])
        stakes_factor = 1 + (pos_diff / 40)  # Bigger gap = slightly more cards
        
        total = round(3.5 * stakes_factor, 1)
        
        return {
            "total": min(7, max(2, total)),
            "over_3.5": 0.55,
            "under_3.5": 0.45,
        }
    
    def predict_ht_ft(self, home_team: str, away_team: str) -> Dict[str, float]:
        """Predict Half Time / Full Time"""
        # Most common HT/FT results
        table_feats = self._get_table_features(home_team, away_team)
        
        home_form = table_feats["home_form"]
        away_form = table_feats["away_form"]
        
        # If home team in good form
        if home_form > 2.0:
            return {
                "HH": 0.25,  # Home/Home
                "HD": 0.10,  # Home/Draw
                "HA": 0.05,  # Home/Away
                "DH": 0.08,  # Draw/Home
                "DD": 0.12,  # Draw/Draw
                "DA": 0.08,  # Draw/Away
                "AH": 0.05,  # Away/Home
                "AD": 0.10,  # Away/Draw
                "AA": 0.17,  # Away/Away
            }
        elif away_form > 2.0:
            return {
                "HH": 0.15,
                "HD": 0.10,
                "HA": 0.10,
                "DH": 0.05,
                "DD": 0.12,
                "DA": 0.13,
                "AH": 0.05,
                "AD": 0.12,
                "AA": 0.18,
            }
        else:
            return {
                "HH": 0.18,
                "HD": 0.10,
                "HA": 0.08,
                "DH": 0.08,
                "DD": 0.18,
                "DA": 0.08,
                "AH": 0.05,
                "AD": 0.10,
                "AA": 0.15,
            }
    
    def predict_asian_handicap(self, home_team: str, away_team: str) -> Dict[str, Any]:
        """Predict Asian Handicap line"""
        table_feats = self._get_table_features(home_team, away_team)
        
        # Goal difference handicap
        gd_diff = table_feats["home_gd"] - table_feats["away_gd"]
        
        # Typical handicap based on quality difference
        if gd_diff > 20:
            line = -1.5
        elif gd_diff > 10:
            line = -1.0
        elif gd_diff > 0:
            line = -0.5
        elif gd_diff > -10:
            line = 0.5
        elif gd_diff > -20:
            line = 1.0
        else:
            line = 1.5
        
        # Home win probability adjusted for handicap
        home_win_prob = self._form_based_1x2(home_team, away_team).get("H", 0.45)
        
        return {
            "line": line,
            "home_cover_prob": round(home_win_prob + 0.1, 3),  # Adjust for handicap
        }
    
    def predict_match(self, home_team: str, away_team: str) -> Dict[str, Any]:
        """Get full prediction for a match"""
        return {
            "home": home_team,
            "away": away_team,
            "1x2": self.predict_1x2(home_team, away_team),
            "over_under": self.predict_over_under(home_team, away_team),
            "btts": self.predict_btts(home_team, away_team),
            "corners": self.predict_corners(home_team, away_team),
            "cards": self.predict_cards(home_team, away_team),
            "ht_ft": self.predict_ht_ft(home_team, away_team),
            "asian_handicap": self.predict_asian_handicap(home_team, away_team),
            "table_context": self._get_table_features(home_team, away_team),
        }
    
    def explain_prediction(self, prediction: Dict) -> str:
        """Generate a natural language explanation of the prediction"""
        home = prediction["home"]
        away = prediction["away"]
        ctx = prediction["table_context"]
        
        # Get form info
        home_form = ctx["home_form"]
        away_form = ctx["away_form"]
        pos_diff = ctx["pos_diff"]
        
        # Build explanation
        lines = []
        lines.append(f"\n🏆 **{home} vs {away}**\n")
        
        # 1X2
        odds_1x2 = prediction["1x2"]
        best_1x2 = max(odds_1x2, key=odds_1x2.get)
        best_val = odds_1x2[best_1x2]
        labels = {"H": f"{home} win", "D": "draw", "A": f"{away} win"}
        lines.append(f"📊 *Match result*: {labels[best_1x2]} ({best_val:.0%})")
        
        # Over/Under
        ou = prediction["over_under"]
        ou_hint = "high-scoring" if ou["over_2.5"] > 0.55 else "low-scoring"
        lines.append(f"⚽ *Goals*: Expect {ou_hint} game (~{ou['expected_goals']} goals)")
        lines.append(f"   Over 2.5: {ou['over_2.5']:.0%} | Under 2.5: {ou['under_2.5']:.0%}")
        
        # BTTS
        btts = prediction["btts"]
        btts_yes = "both teams score" if btts["yes"] > 0.5 else "clean sheet likely"
        lines.append(f"🥅 *BTTS*: {btts_yes} ({btts['yes']:.0%})")
        
        # Corners
        corners = prediction["corners"]
        lines.append(f"📐 *Corners*: ~{corners['total']} total expected")
        lines.append(f"   {home}: ~{corners['home_corners']} | {away}: ~{corners['away_corners']}")
        
        # HT/FT
        htft = prediction["ht_ft"]
        best_htft = max(htft, key=htft.get)
        htft_labels = {
            "HH": f"{home} lead at half & win",
            "HD": f"{home} lead at half, draw final",
            "HA": f"{home} lead at half, {away} win",
            "DH": "draw at half, home win",
            "DD": "draw half & final",
            "DA": "draw at half, away win",
            "AH": f"{away} lead, {home} win",
            "AD": f"{away} lead, draw",
            "AA": f"{away} lead & win",
        }
        lines.append(f"⏱️ *Half/Full*: {htft_labels.get(best_htft, best_htft)} ({htft[best_htft]:.0%})")
        
        # Form context
        lines.append(f"\n📈 *Form guide*:")
        lines.append(f"   {home}: {ctx['home_form']:.2f} avg pts (pos {ctx['home_pos']})")
        lines.append(f"   {away}: {ctx['away_form']:.2f} avg pts (pos {ctx['away_pos']})")
        
        return "\n".join(lines)


# Singleton instance
_service = None

def get_prediction_service() -> PredictionService:
    global _service
    if _service is None:
        _service = PredictionService()
    return _service


if __name__ == "__main__":
    # Test
    ps = get_prediction_service()
    pred = ps.predict_match("Arsenal", "Liverpool")
    print(ps.explain_prediction(pred))
