"""
Prediction Engine for Premier League and HK Horse Racing
Combines statistical models with MiniMax AI for enhanced predictions
"""

import os
import json
import httpx
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
import asyncio

load_dotenv()

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
MINIMAX_BASE_URL = "https://api.minimax.chat/v1"

# =============================================================================
# FOOTBALL (PREMIER LEAGUE) PREDICTIONS
# =============================================================================

class FootballPredictor:
    """Statistical prediction model for Premier League matches"""
    
    # Home advantage constants (based on historical PL data)
    HOME_GOALS_AVG = 1.55
    AWAY_GOALS_AVG = 1.15
    HOME_WIN_PROB = 0.46
    DRAW_PROB = 0.27
    AWAY_WIN_PROB = 0.27
    
    def __init__(self):
        self.markets = [
            "1X2",              # Home/Draw/Away
            "Over_Under_2.5",   # Over/Under 2.5 goals
            "BTTS",             # Both Teams To Score
            "Correct_Score",    # Exact score
            "Double_Chance",    # 1X, X2, or 12
            "Asian_Hicap"       # Asian Handicap
        ]
    
    def predict(self, home_team: dict, away_team: dict, match_stats: dict = None) -> dict:
        """
        Generate predictions for all markets
        
        Args:
            home_team: Team data including form, stats, injuries
            away_team: Same structure for away team
            match_stats: Historical head-to-head and current form
        
        Returns:
            Predictions for all markets with probabilities and confidence
        """
        predictions = {}
        
        # Calculate base probabilities
        form_factor = self._calculate_form_factor(home_team, away_team)
        home_advantage = 1.15  # 15% home boost
        
        # 1X2 Prediction
        predictions["1X2"] = self._predict_1x2(home_team, away_team, form_factor, home_advantage)
        
        # Over/Under 2.5
        predictions["Over_Under_2.5"] = self._predict_over_under(home_team, away_team, form_factor)
        
        # Both Teams To Score
        predictions["BTTS"] = self._predict_btts(home_team, away_team, form_factor)
        
        # Correct Score
        predictions["Correct_Score"] = self._predict_correct_score(home_team, away_team, form_factor)
        
        # Double Chance
        predictions["Double_Chance"] = self._predict_double_chance(predictions["1X2"])
        
        # Asian Handicap
        predictions["Asian_Hicap"] = self._predict_asian_handicap(home_team, away_team, form_factor)
        
        return predictions
    
    def _calculate_form_factor(self, home: dict, away: dict) -> float:
        """Calculate form adjustment factor based on recent performance"""
        home_form = home.get("form", 5) / 10  # Normalize to 0-1
        away_form = away.get("form", 5) / 10
        
        # Form advantage for home team
        return (home_form * 1.1) - (away_form * 0.9)
    
    def _predict_1x2(self, home: dict, away: dict, form_factor: float, home_adv: float) -> dict:
        """Predict 1X2 market"""
        # Base probabilities adjusted for form and home advantage
        home_win = (self.HOME_WIN_PROB + (form_factor * 0.1) + (home_adv - 1)) * 0.9
        draw = self.DRAW_PROB * 0.95
        away_win = (self.AWAY_WIN_PROB - (form_factor * 0.1)) * 0.9
        
        # Normalize to sum to 1
        total = home_win + draw + away_win
        home_win /= total
        draw /= total
        away_win /= total
        
        return {
            "Home_Win": {"probability": round(home_win, 3), "odds": round(1/home_win, 2)},
            "Draw": {"probability": round(draw, 3), "odds": round(1/draw, 2)},
            "Away_Win": {"probability": round(away_win, 3), "odds": round(1/away_win, 2)}
        }
    
    def _predict_over_under(self, home: dict, away: dict, form_factor: float) -> dict:
        """Predict Over/Under 2.5 goals"""
        expected_goals = (self.HOME_GOALS_AVG + self.AWAY_GOALS_AVG) / 2 + (form_factor * 0.3)
        
        # Poisson-ish distribution
        over_prob = min(0.7, 0.3 + (expected_goals - 2.5) * 0.15)
        under_prob = 1 - over_prob
        
        return {
            "Over_2.5": {"probability": round(over_prob, 3), "odds": round(1/over_prob, 2)},
            "Under_2.5": {"probability": round(under_prob, 3), "odds": round(1/under_prob, 2)}
        }
    
    def _predict_btts(self, home: dict, away: dict, form_factor: float) -> dict:
        """Predict Both Teams To Score"""
        # Base BTTS rate in PL is ~55%
        home_attack = home.get("attack_strength", 0.5)
        away_attack = away.get("attack_strength", 0.5)
        
        btts_yes = 0.50 + ((home_attack + away_attack) / 2) * 0.15 + (form_factor * 0.05)
        btts_yes = min(0.75, max(0.35, btts_yes))
        
        return {
            "Yes": {"probability": round(btts_yes, 3), "odds": round(1/btts_yes, 2)},
            "No": {"probability": round(1-btts_yes, 3), "odds": round(1/(1-btts_yes), 2)}
        }
    
    def _predict_correct_score(self, home: dict, away: dict, form_factor: float) -> dict:
        """Predict most likely correct score"""
        expected_home = self.HOME_GOALS_AVG + (form_factor * 0.4)
        expected_away = self.AWAY_GOALS_AVG - (form_factor * 0.3)
        
        # Most likely scores
        scores = [
            ("1-1", 0.15),
            ("2-1", 0.12),
            ("1-2", 0.10),
            ("2-0", 0.10),
            ("0-1", 0.08),
            ("1-0", 0.08),
            ("2-2", 0.07),
            ("0-2", 0.05),
            ("3-1", 0.04),
            ("1-3", 0.03),
        ]
        
        result = {}
        for score, prob in scores:
            adjusted_prob = prob * (1 + form_factor * 0.1 * (1 if "1" in score[0] else -1))
            result[score] = {
                "probability": round(min(0.25, adjusted_prob), 3),
                "odds": round(1/min(0.25, adjusted_prob), 2)
            }
        
        return result
    
    def _predict_double_chance(self, odds_1x2: dict) -> dict:
        """Predict Double Chance markets"""
        return {
            "1X": {"probability": round(odds_1x2["Home_Win"]["probability"] + odds_1x2["Draw"]["probability"], 3)},
            "X2": {"probability": round(odds_1x2["Draw"]["probability"] + odds_1x2["Away_Win"]["probability"], 3)},
            "12": {"probability": round(odds_1x2["Home_Win"]["probability"] + odds_1x2["Away_Win"]["probability"], 3)}
        }
    
    def _predict_asian_handicap(self, home: dict, away: dict, form_factor: float) -> dict:
        """Predict Asian Handicap"""
        # Default handicap based on form difference
        handicap = round(form_factor * 0.5, 2)  # -0.5 to +0.5 range
        
        home_prob = 0.5 + (form_factor * 0.1)
        home_prob = min(0.65, max(0.35, home_prob))
        
        return {
            f"Home {handicap:+0.1}": {"probability": round(home_prob, 3), "odds": round(1/home_prob, 2)},
            f"Away {handicap:+0.1}": {"probability": round(1-home_prob, 3), "odds": round(1/(1-home_prob), 2)}
        }
    
    def get_confidence(self, probability: float) -> str:
        """Get confidence level based on probability"""
        if probability >= 0.65:
            return "High"
        elif probability >= 0.50:
            return "Medium"
        else:
            return "Low"


# =============================================================================
# HK HORSE RACING PREDICTIONS  
# =============================================================================

class HorseRacingPredictor:
    """Statistical prediction model for HK Horse Racing"""
    
    def __init__(self):
        self.markets = [
            "Win_Place_Show",  # Basic win/place/show
            "Quinella",        # First two in any order
            "Trifecta",        # First three in order
            "Quartet"          # First four in order
        ]
    
    def predict(self, horses: list, race_conditions: dict = None) -> dict:
        """
        Generate predictions for all markets
        
        Args:
            horses: List of horse data (name, draw, form, weight, jockey, trainer)
            race_conditions: Track conditions, weather, distance
        
        Returns:
            Predictions for all markets with probabilities
        """
        if not horses:
            return {}
        
        predictions = {}
        
        # Calculate ratings for each horse
        ratings = self._calculate_ratings(horses, race_conditions)
        
        # Win/Place/Show predictions
        predictions["Win_Place_Show"] = self._predict_win_place_show(ratings, horses)
        
        # Quinella (top 2 in any order)
        predictions["Quinella"] = self._predict_quinella(ratings)
        
        # Trifecta (top 3 in order)
        predictions["Trifecta"] = self._predict_trifecta(ratings)
        
        # Quartet (top 4 in order)
        predictions["Quartet"] = self._predict_quartet(ratings)
        
        return predictions
    
    def _calculate_ratings(self, horses: list, conditions: dict) -> list:
        """Calculate performance ratings for all horses"""
        rated_horses = []
        
        for horse in horses:
            rating = 0
            
            # Form rating (0-40 points)
            form = horse.get("last_5", "")
            if form:
                form_score = sum(int(x) for x in form.split("-") if x.isdigit())
                # Lower is better in HK racing
                form_rating = max(0, 15 - form_score)
                rating += form_rating
            
            # Jockey/Trainer combo (0-30 points)
            jockey = horse.get("jockey", "")
            trainer = horse.get("trainer", "")
            rating += hash(jockey + trainer) % 30
            
            # Draw position (0-20 points) - middle draws often better at HK
            draw = horse.get("draw", 10)
            draw_rating = 20 - abs(draw - 7) * 2
            rating += max(0, draw_rating)
            
            # Weight carried (0-10 points) - lighter is better
            weight = horse.get("weight", 1200)
            weight_rating = max(0, (1300 - weight) / 20)
            rating += weight_rating
            
            # Distance suitability (0-20 points)
            distance = horse.get("distance", 1200)
            # Simplified - actual would check historical over distance
            rating += 10
            
            # Track condition adjustment
            if conditions:
                going = conditions.get("going", "Good")
                weather = conditions.get("weather", {}).get("weather", "Clear")
                
                # Heavy going favors certain horses
                if "Heavy" in going or "Slow" in going:
                    rating += 5  # More tollerant horses
            
            rated_horses.append({
                "horse": horse,
                "rating": rating,
                "name": horse.get("name", f"Horse {horse.get('horse_number', '?')}")
            })
        
        # Sort by rating (highest first)
        rated_horses.sort(key=lambda x: x["rating"], reverse=True)
        
        # Convert ratings to probabilities
        total_rating = sum(h["rating"] for h in rated_horses)
        for h in rated_horses:
            h["probability"] = h["rating"] / total_rating if total_rating > 0 else 0
        
        return rated_horses
    
    def _predict_win_place_show(self, ratings: list, horses: list) -> dict:
        """Predict Win, Place, Show"""
        # Win - top rated
        win_prob = {ratings[0]["name"]: {"probability": ratings[0]["probability"], "odds": round(1/ratings[0]["probability"], 2)}}
        
        # Place - top 3 have place chances
        place_prob = {}
        for i, h in enumerate(ratings[:4]):
            place_chance = h["probability"] * (1.5 - i * 0.1)
            place_prob[h["name"]] = {"probability": round(min(0.9, place_chance), 3)}
        
        # Show - top 5 have show chances
        show_prob = {}
        for i, h in enumerate(ratings[:6]):
            show_chance = h["probability"] * (1.8 - i * 0.12)
            show_prob[h["name"]] = {"probability": round(min(0.95, show_chance), 3)}
        
        return {
            "Win": win_prob,
            "Place": place_prob,
            "Show": show_prob
        }
    
    def _predict_quinella(self, ratings: list) -> dict:
        """Predict Quinella (top 2 in any order)"""
        quinellas = []
        
        # Top 5 horses for quinella combinations
        for i in range(min(5, len(ratings))):
            for j in range(i+1, min(5, len(ratings))):
                h1, h2 = ratings[i], ratings[j]
                prob = h1["probability"] * h2["probability"] * 2  # Either order
                quinellas.append({
                    "combination": f"{h1['name']} & {h2['name']}",
                    "probability": round(min(0.3, prob), 3),
                    "odds": round(1/min(0.3, prob), 2)
                })
        
        # Sort by probability
        quinellas.sort(key=lambda x: x["probability"], reverse=True)
        return {q["combination"]: {"probability": q["probability"], "odds": q["odds"]} for q in quinellas[:10]}
    
    def _predict_trifecta(self, ratings: list) -> dict:
        """Predict Trifecta (top 3 in exact order)"""
        trifectas = []
        
        # Top 5 for trifecta combinations
        for i in range(min(5, len(ratings))):
            for j in range(min(5, len(ratings))):
                for k in range(min(5, len(ratings))):
                    if i != j and j != k and i != k:
                        h1, h2, h3 = ratings[i], ratings[j], ratings[k]
                        prob = h1["probability"] * h2["probability"] * h3["probability"] * 6
                        if prob > 0.001:
                            trifectas.append({
                                "combination": f"{h1['name']} - {h2['name']} - {h3['name']}",
                                "probability": round(min(0.15, prob), 4),
                                "odds": round(1/min(0.15, prob), 2)
                            })
        
        trifectas.sort(key=lambda x: x["probability"], reverse=True)
        return {t["combination"]: {"probability": t["probability"], "odds": t["odds"]} for t in trifectas[:10]}
    
    def _predict_quartet(self, ratings: list) -> dict:
        """Predict Quartet (top 4 in exact order)"""
        quartets = []
        
        # Top 6 for quartet combinations
        for i in range(min(6, len(ratings))):
            for j in range(min(6, len(ratings))):
                for k in range(min(6, len(ratings))):
                    for l in range(min(6, len(ratings))):
                        if len({i, j, k, l}) == 4:
                            h1, h2, h3, h4 = ratings[i], ratings[j], ratings[k], ratings[l]
                            prob = h1["probability"] * h2["probability"] * h3["probability"] * h4["probability"] * 24
                            if prob > 0.0001:
                                quartets.append({
                                    "combination": f"{h1['name']} - {h2['name']} - {h3['name']} - {h4['name']}",
                                    "probability": round(min(0.08, prob), 5),
                                    "odds": round(1/min(0.08, prob), 2)
                                })
        
        quartets.sort(key=lambda x: x["probability"], reverse=True)
        return {q["combination"]: {"probability": q["probability"], "odds": q["odds"]} for q in quartets[:10]}


# =============================================================================
# MINIMAX AI ENHANCEMENT
# =============================================================================

class MiniMaxEnhancer:
    """Use MiniMax LLM to enhance predictions with natural language insights"""
    
    def __init__(self):
        self.api_key = MINIMAX_API_KEY
        self.model = "abab5.5-chat"
    
    async def generate_insights(self, match_data: dict, predictions: dict) -> dict:
        """Generate AI insights for a football match"""
        if not self.api_key:
            return {"insights": "Add MINIMAX_API_KEY for AI insights", "factors": []}
        
        prompt = f"""
Based on this Premier League match data:
- {match_data.get('home_team', 'Home Team')} vs {match_data.get('away_team', 'Away Team')}
- Home form: {match_data.get('home_form', 'Unknown')}
- Away form: {match_data.get('away_form', 'Unknown')}
- Key stats: {match_data.get('stats', {})}

Predicted probabilities:
{predictions}

Provide:
1. A brief match insight (2-3 sentences)
2. Top 3 key factors that influenced the prediction
3. A confidence assessment

Keep it concise and in plain English.
"""
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{MINIMAX_BASE_URL}/text/chatcompletion_v2",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}]
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                
                return {
                    "insights": result.get("choices", [{}])[0].get("message", {}).get("content", ""),
                    "factors": self._extract_factors(result),
                    "enhanced": True
                }
        except Exception as e:
            print(f"MiniMax API error: {e}")
            return {"insights": "AI insights unavailable", "factors": [], "enhanced": False}
    
    async def generate_race_insights(self, race_data: dict, predictions: dict) -> dict:
        """Generate AI insights for a horse race"""
        if not self.api_key:
            return {"insights": "Add MINIMAX_API_KEY for AI insights", "factors": []}
        
        prompt = f"""
Based on this HK Horse Race data:
- Venue: {race_data.get('venue', 'Unknown')}
- Distance: {race_data.get('distance', 'Unknown')}m
- Going: {race_data.get('going', 'Unknown')}
- Weather: {race_data.get('weather', 'Unknown')}

Horses: {[h.get('name', 'Unknown') for h in race_data.get('horses', [])[:5]]}

Top predictions: {predictions}

Provide:
1. A brief race insight (2-3 sentences)
2. Top 3 factors to consider
3. Which horse looks strongest and why

Keep it concise.
"""
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{MINIMAX_BASE_URL}/text/chatcompletion_v2",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}]
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                
                return {
                    "insights": result.get("choices", [{}])[0].get("message", {}).get("content", ""),
                    "factors": self._extract_factors(result),
                    "enhanced": True
                }
        except Exception as e:
            print(f"MiniMax API error: {e}")
            return {"insights": "AI insights unavailable", "factors": [], "enhanced": False}
    
    def _extract_factors(self, api_response: dict) -> list:
        """Extract key factors from API response"""
        # Simplified - actual implementation would parse the response
        return []


# =============================================================================
# MAIN PREDICTION ORCHESTRATOR
# =============================================================================

class PredictionOrchestrator:
    """Main class that combines data, models, and AI for predictions"""
    
    def __init__(self):
        self.football = FootballPredictor()
        self.horses = HorseRacingPredictor()
        self.ai = MiniMaxEnhancer()
    
    async def predict_football_match(self, home_team: dict, away_team: dict, 
                                    match_data: dict = None, enhance: bool = True) -> dict:
        """Generate full predictions for a football match"""
        predictions = self.football.predict(home_team, away_team, match_data)
        
        result = {
            "predictions": predictions,
            "market_count": len(predictions),
            "timestamp": datetime.now().isoformat()
        }
        
        if enhance:
            ai_insights = await self.ai.generate_insights(
                {"home_team": home_team.get("name"), "away_team": away_team.get("name"), **match_data or {}},
                predictions
            )
            result["ai_insights"] = ai_insights
        
        return result
    
    async def predict_race(self, horses: list, race_data: dict = None,
                          enhance: bool = True) -> dict:
        """Generate full predictions for a horse race"""
        race_conditions = race_data.get("conditions", {}) if race_data else None
        predictions = self.horses.predict(horses, race_conditions)
        
        result = {
            "predictions": predictions,
            "market_count": len(predictions),
            "timestamp": datetime.now().isoformat()
        }
        
        if enhance:
            ai_insights = await self.ai.generate_race_insights(race_data or {}, predictions)
            result["ai_insights"] = ai_insights
        
        return result


if __name__ == "__main__":
    # Test the prediction engine
    predictor = PredictionOrchestrator()
    
    # Test football
    import asyncio
    
    async def test_football():
        home = {"name": "Arsenal", "form": 8, "attack_strength": 0.8}
        away = {"name": "Liverpool", "form": 7, "attack_strength": 0.75}
        
        result = await predictor.predict_football_match(home, away)
        print("=== Football Prediction ===")
        print(f"Markets: {result['market_count']}")
        print(f"1X2: {result['predictions']['1X2']}")
    
    asyncio.run(test_football())
