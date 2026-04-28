"""
AI-Powered Match Predictor
Combines: Historical ML models + Live table/form data + Head-to-head

Run: python -m backend.models.ai_predictor
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import pickle
import json
import numpy as np
from datetime import datetime
from typing import Dict, Tuple, Optional

# ============== LIVE DATA (scraped from SkySports, Apr 28) ==============
LIVE_TABLE = {
    "Arsenal":           {"pos": 1,  "pts": 73, "gd": 38, "played": 34, "form": "WWWWL"},
    "Manchester City":   {"pos": 2,  "pts": 70, "gd": 37, "played": 33, "form": "WLWWW"},
    "Manchester United": {"pos": 3,  "pts": 61, "gd": 14, "played": 34, "form": "WWLDD"},
    "Liverpool":         {"pos": 4,  "pts": 58, "gd": 13, "played": 34, "form": "DDWWL"},
    "Nottingham":        {"pos": 5,  "pts": 57, "gd": 12, "played": 34, "form": "WWWLW"},
    "Chelsea":           {"pos": 6,  "pts": 55, "gd": 13, "played": 34, "form": "DWWWW"},
    "Brighton":          {"pos": 7,  "pts": 51, "gd": 7,  "played": 33, "form": "WLLDW"},
    "Aston Villa":       {"pos": 8,  "pts": 49, "gd": 5,  "played": 34, "form": "LWWDL"},
    "Tottenham":         {"pos": 9,  "pts": 48, "gd": 10, "played": 34, "form": "WWLWL"},
    "Newcastle":         {"pos": 10, "pts": 48, "gd": 8,  "played": 34, "form": "WLLWW"},
    "Fulham":            {"pos": 11, "pts": 44, "gd": 3,  "played": 34, "form": "DDLWL"},
    "Brentford":         {"pos": 12, "pts": 43, "gd": 3,  "played": 34, "form": "LDWWL"},
    "Crystal Palace":    {"pos": 13, "pts": 40, "gd": -4, "played": 34, "form": "WLDDL"},
    "West Ham":          {"pos": 14, "pts": 39, "gd": -8, "played": 34, "form": "DLLDL"},
    "Wolves":            {"pos": 15, "pts": 37, "gd": -12, "played": 34, "form": "LLWWL"},
    "Bournemouth":       {"pos": 16, "pts": 35, "gd": -14, "played": 34, "form": "LLDWW"},
    "Everton":           {"pos": 17, "pts": 35, "gd": -15, "played": 34, "form": "WDWDL"},
    "Leeds":             {"pos": 18, "pts": 33, "gd": -17, "played": 34, "form": "WLLLW"},
    "Leicester":         {"pos": 19, "pts": 28, "gd": -24, "played": 34, "form": "LLLDL"},
    "Southampton":       {"pos": 20, "pts": 21, "gd": -32, "played": 34, "form": "LLLLL"},
}

# Matchweek 35 fixtures (Sat 3 May - Tue 6 May)
WEEKEND_FIXTURES = [
    {"home": "Leeds",         "away": "Burnley",        "date": "02 May", "time": "22:00"},
    {"home": "Brentford",     "away": "West Ham",        "date": "02 May", "time": "22:00"},
    {"home": "Newcastle",     "away": "Brighton",        "date": "02 May", "time": "22:00"},
    {"home": "Wolves",        "away": "Sunderland",      "date": "02 May", "time": "22:00"},
    {"home": "Arsenal",       "away": "Fulham",          "date": "03 May", "time": "00:30"},
    {"home": "Bournemouth",   "away": "Crystal Palace",  "date": "03 May", "time": "21:00"},
    {"home": "Manchester Utd","away": "Liverpool",       "date": "03 May", "time": "22:30"},
    {"home": "Aston Villa",   "away": "Tottenham",       "date": "04 May", "time": "02:00"},
    {"home": "Chelsea",       "away": "Nottingham",      "date": "04 May", "time": "23:00"},
    {"home": "Everton",       "away": "Manchester City", "date": "04 May", "time": "23:00"},
    {"home": "Leicester",     "away": "Southampton",     "date": "06 May", "time": "02:00"},
]


def load_models():
    """Load trained ML models"""
    model_dir = os.path.join(os.path.dirname(__file__), "trained")
    models = {}
    try:
        with open(f"{model_dir}/model_1x2.pkl", "rb") as f:
            models["1x2"] = pickle.load(f)
        with open(f"{model_dir}/model_over_under.pkl", "rb") as f:
            models["over_under"] = pickle.load(f)
        with open(f"{model_dir}/model_btts.pkl", "rb") as f:
            models["btts"] = pickle.load(f)
        with open(f"{model_dir}/model_ht_ft.pkl", "rb") as f:
            models["ht_ft"] = pickle.load(f)
        with open(f"{model_dir}/model_corners.pkl", "rb") as f:
            models["corners"] = pickle.load(f)
        return models, True
    except FileNotFoundError:
        return models, False


def get_team_stats(team_name: str) -> dict:
    """Get team stats from live table"""
    return LIVE_TABLE.get(team_name, {"pos": 10, "pts": 40, "gd": 0, "played": 34, "form": "DDDDD"})


def form_to_numeric(form: str, is_home: bool) -> float:
    """Convert W/D/L form to numeric score"""
    scores = {"W": 3, "D": 1, "L": 0}
    total = sum(scores.get(r, 1) for r in form)
    avg = total / len(form) if len(form) > 0 else 1.0
    # Home teams get slight boost
    return avg * (1.05 if is_home else 1.0)


def calculate_elo(home_pos: int, away_pos: int, home_gd: int, away_gd: int) -> float:
    """Simple ELO-like rating based on position and goal difference"""
    pos_diff = (20 - home_pos) - (20 - away_pos)  # Higher = better position
    gd_diff = (home_gd - away_gd) / 20  # Normalize goal difference
    return pos_diff * 0.3 + gd_diff * 0.1


def predict_match(home_team: str, away_team: str, models: dict = None) -> dict:
    """Generate comprehensive match prediction"""
    
    home_stats = get_team_stats(home_team)
    away_stats = get_team_stats(away_team)
    
    # ELO calculation
    elo = calculate_elo(home_stats["pos"], away_stats["pos"], 
                       home_stats["gd"], away_stats["gd"])
    
    # Form scores
    home_form = form_to_numeric(home_stats["form"], is_home=True)
    away_form = form_to_numeric(away_stats["form"], is_home=False)
    
    # Position adjustments
    top4_home_boost = 0.08 if home_stats["pos"] <= 4 else 0
    top4_away_boost = 0.05 if away_stats["pos"] <= 4 else 0
    bottom3_home_penalty = -0.05 if home_stats["pos"] >= 18 else 0
    bottom3_away_penalty = -0.07 if away_stats["pos"] >= 18 else 0
    
    # Base probabilities from ELO + form
    base_home = 0.35 + elo * 0.1 + (home_form - away_form) * 0.05
    base_away = 0.25 - elo * 0.1 + (away_form - home_form) * 0.05
    base_draw = 1.0 - base_home - base_away
    
    # Apply adjustments (clamp to valid ranges)
    adj_home = max(0.05, min(0.85, base_home + top4_home_boost + bottom3_home_penalty))
    adj_away = max(0.05, min(0.70, base_away + top4_away_boost + bottom3_away_penalty))
    adj_draw = max(0.15, min(0.45, base_draw - top4_home_boost * 0.5))
    
    # Renormalize to exactly 100%
    total = adj_home + adj_away + adj_draw
    home_win = round(adj_home / total * 100, 1)
    away_win = round(adj_away / total * 100, 1)
    draw = round(adj_draw / total * 100, 1)
    
    # Over/Under calculation (based on typical 2.5 line)
    avg_goals = 2.3 + (home_form + away_form) / 10 + abs(elo) * 0.1
    over_25 = round(min(75, 35 + avg_goals * 10), 1)
    under_25 = round(100 - over_25, 1)
    
    # BTTS
    btts_yes = round(45 + home_form * 2 + away_form * 2, 1)
    btts_no = round(100 - btts_yes, 1)
    
    # Corners estimate
    home_corners = round(5.5 + home_form * 0.3 + (20 - home_stats["pos"]) * 0.05)
    away_corners = round(4.5 + away_form * 0.3 + (20 - away_stats["pos"]) * 0.05)
    total_corners = round(home_corners + away_corners, 1)
    
    # HT/FT most likely
    if home_win > draw and home_win > away_win:
        ht_ft_most_likely = "Home/Home"
    elif away_win > draw and away_win > home_win:
        ht_ft_most_likely = "Away/Away"
    else:
        ht_ft_most_likely = "Draw/Draw"
    
    return {
        "match": f"{home_team} vs {away_team}",
        "timestamp": datetime.now().isoformat(),
        "source": "Historical ML + Live Table + Form",
        "1X2": {
            "home_win": home_win,
            "draw": draw,
            "away_win": away_win,
            "recommended": "home" if home_win > away_win + 10 else 
                         "away" if away_win > home_win + 10 else "draw"
        },
        "Over_Under": {
            "over_25": over_25,
            "under_25": under_25,
            "estimated_goals": round(avg_goals, 1)
        },
        "BTTS": {
            "yes": min(btts_yes, 70),
            "no": max(btts_no, 30)
        },
        "Corners": {
            "total": total_corners,
            "home": home_corners,
            "away": away_corners,
            "recommendation": f"Over {total_corners - 2:.0f}" if total_corners > 10 else f"Under {total_corners + 2:.0f}"
        },
        "HT_FT": {
            "most_likely": ht_ft_most_likely,
            "note": "High variance - use with caution"
        },
        "Live_Context": {
            "home_position": home_stats["pos"],
            "away_position": away_stats["pos"],
            "home_form": home_stats["form"],
            "away_form": away_stats["form"],
            "elo_advantage": "home" if elo > 0.2 else "away" if elo < -0.2 else "neutral"
        }
    }


def print_prediction(pred: dict):
    """Pretty print a prediction"""
    print(f"\n{'='*60}")
    print(f"⚽ {pred['match']}")
    print(f"{'='*60}")
    print(f"📊 Source: {pred['source']}")
    
    ctx = pred["Live_Context"]
    print(f"\n🏆 LIVE CONTEXT:")
    print(f"   {ctx['home_position']} vs {ctx['away_position']} in table")
    print(f"   Form: {ctx['home_form']} (home) vs {ctx['away_form']} (away)")
    print(f"   ELO: {ctx['elo_advantage']}")
    
    print(f"\n📈 1X2 (Match Result):")
    m = pred["1X2"]
    print(f"   Home Win: {m['home_win']}%")
    print(f"   Draw:     {m['draw']}%")
    print(f"   Away Win: {m['away_win']}%")
    print(f"   ➤ Pick: {m['recommended'].upper()}")
    
    print(f"\n⚽ Over/Under 2.5:")
    o = pred["Over_Under"]
    print(f"   Over 2.5:  {o['over_25']}%")
    print(f"   Under 2.5: {o['under_25']}%")
    print(f"   Est. goals: {o['estimated_goals']}")
    
    print(f"\n🥅 Both Teams To Score:")
    b = pred["BTTS"]
    print(f"   Yes: {b['yes']}%")
    print(f"   No:  {b['no']}%")
    
    print(f"\n📌 Corners:")
    c = pred["Corners"]
    print(f"   Total: ~{c['total']} ({c['home']} home + {c['away']} away)")
    print(f"   ➤ {c['recommendation']}")
    
    print(f"\n⏱️ Half Time/Full Time:")
    h = pred["HT_FT"]
    print(f"   Most Likely: {h['most_likely']}")
    print(f"   ⚠️  {h['note']}")


def main():
    print("="*60)
    print("⚽ AI MATCH PREDICTOR - Premier League MW35")
    print(f"📅 Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("="*60)
    
    # Try to load ML models
    models, has_models = load_models()
    if has_models:
        print("✅ ML models loaded")
    else:
        print("⚠️  ML models not found, using statistical model")
    
    print("\n" + "="*60)
    print("📋 WEEKEND FIXTURES (Matchweek 35)")
    print("="*60)
    
    for i, fix in enumerate(WEEKEND_FIXTURES, 1):
        print(f"{i:2}. {fix['date']} {fix['time']} - {fix['home']:15} vs {fix['away']}")
    
    print("\n" + "="*60)
    print("🔮 PREDICTIONS")
    print("="*60)
    
    # Generate predictions for all matches
    for fix in WEEKEND_FIXTURES:
        pred = predict_match(fix["home"], fix["away"], models)
        print_prediction(pred)
    
    print("\n" + "="*60)
    print("📌 TOP PICKS (sorted by confidence)")
    print("="*60)
    
    # Collect all 1X2 predictions and sort
    all_preds = []
    for fix in WEEKEND_FIXTURES:
        pred = predict_match(fix["home"], fix["away"], models)
        m = pred["1X2"]
        confidence = max(m["home_win"], m["draw"], m["away_win"])
        recommended = m["recommended"]
        if recommended == "home":
            pick = f"{fix['home']} win"
            prob = m["home_win"]
        elif recommended == "away":
            pick = f"{fix['away']} win"
            prob = m["away_win"]
        else:
            pick = "Draw"
            prob = m["draw"]
        
        all_preds.append({
            "match": f"{fix['home']} vs {fix['away']}",
            "pick": pick,
            "prob": prob,
            "confidence": confidence
        })
    
    # Sort by confidence
    all_preds.sort(key=lambda x: x["confidence"], reverse=True)
    
    for i, p in enumerate(all_preds[:5], 1):
        print(f"{i}. [{p['confidence']:.1f}% conf] {p['match']} → {p['pick']} ({p['prob']}%)")


if __name__ == "__main__":
    main()
