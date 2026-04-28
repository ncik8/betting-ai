"""
Weekend Premier League Predictions
Predicts all matches for the weekend
"""

import pandas as pd
from pathlib import Path
from math import factorial, exp

DATA_DIR = Path(__file__).parent.parent.parent / "data"

def poisson(goals, avg):
    return (avg ** goals * exp(-avg)) / factorial(int(goals))

def get_team_record(df, team, venue="home"):
    """Get team's home or away record"""
    if venue == "home":
        games = df[df["HomeTeam"] == team]
    else:
        games = df[df["AwayTeam"] == team]
    
    if len(games) == 0:
        return {"gf": 1.4, "ga": 1.2, "win_rate": 0.35}
    
    if venue == "home":
        gf = games["FTHG"].mean()
        ga = games["FTAG"].mean()
        wins = (games["FTR"] == "H").mean()
    else:
        gf = games["FTAG"].mean()
        ga = games["FTHG"].mean()
        wins = (games["FTR"] == "A").mean()
    
    return {"gf": gf, "ga": ga, "win_rate": wins}

def predict_match(df, home_team, away_team):
    """Generate predictions for a match"""
    home_record = get_team_record(df, home_team, "home")
    away_record = get_team_record(df, away_team, "away")
    
    # Expected goals
    home_xg = (home_record['gf'] + away_record['ga']) / 2
    away_xg = (away_record['gf'] + home_record['ga']) / 2
    
    # 1X2
    expected_diff = home_xg - away_xg
    home_win_prob = 0.35 + (expected_diff * 0.15)
    away_win_prob = 0.30 + (-expected_diff * 0.12)
    draw_prob = 1 - home_win_prob - away_win_prob
    
    total = home_win_prob + away_win_prob + draw_prob
    home_win_prob /= total
    away_win_prob /= total
    draw_prob /= total
    
    # Over/Under 2.5
    total_xg = home_xg + away_xg
    over_prob = sum(poisson(h, home_xg) * poisson(a, away_xg) 
                   for h in range(4) for a in range(4) if h + a > 2)
    
    # BTTS
    p_home_scores = 1 - poisson(0, home_xg)
    p_away_scores = 1 - poisson(0, away_xg)
    btts_yes = p_home_scores * p_away_scores
    
    # Most likely correct score
    scores = []
    for h in range(4):
        for a in range(4):
            p = poisson(h, home_xg) * poisson(a, away_xg)
            if p > 0.01:
                scores.append((f"{h}-{a}", p))
    scores.sort(key=lambda x: x[1], reverse=True)
    
    return {
        "home": home_team,
        "away": away_team,
        "home_xg": home_xg,
        "away_xg": away_xg,
        "home_win_prob": home_win_prob,
        "draw_prob": draw_prob,
        "away_win_prob": away_win_prob,
        "over_prob": over_prob,
        "btts_yes": btts_yes,
        "likely_score": scores[0] if scores else ("0-0", 0.1),
        "scores": scores[:3]
    }

def main():
    # Load last 3 seasons
    seasons = ["2122", "2223", "2324"]
    all_dfs = []
    for s in seasons:
        filepath = DATA_DIR / f"E0_{s}.csv"
        if filepath.exists():
            all_dfs.append(pd.read_csv(filepath, on_bad_lines='skip'))
    df = pd.concat(all_dfs, ignore_index=True)
    
    # Matchweek 35 fixtures (Sat 2 May - Tue 5 May 2026)
    fixtures = [
        # Saturday 2 May
        ("Leeds United", "Burnley"),
        ("Leicester", "Sunderland"),
        ("Everton", "Aston Villa"),
        ("West Ham", "Southampton"),
        ("Crystal Palace", "Liverpool"),
        ("Nottm Forest", "Man City"),
        # Sunday 3 May
        ("Man Utd", "Chelsea"),
        ("Tottenham", "Arsenal"),
        ("Newcastle", "Wolves"),
        ("Brighton", "Fulham"),
        (" Brentford", "West Brom"),
    ]
    
    print("=" * 70)
    print("🏆 PREMIER LEAGUE MATCHWEEK 35 PREDICTIONS")
    print("   Sat 2 May - Tue 5 May 2026")
    print("=" * 70)
    
    results = []
    for home, away in fixtures:
        try:
            pred = predict_match(df, home.strip(), away.strip())
            results.append(pred)
        except Exception as e:
            print(f"Error predicting {home} vs {away}: {e}")
    
    # Sort by confidence (win probability)
    results.sort(key=lambda x: max(x["home_win_prob"], x["away_win_prob"]), reverse=True)
    
    print("\n📊 ALL MATCHES PREDICTIONS\n")
    
    for i, r in enumerate(results, 1):
        # Determine favorite
        if r["home_win_prob"] > r["away_win_prob"] and r["home_win_prob"] > r["draw_prob"]:
            favorite = f"{r['home']} (Home)"
            confidence = r["home_win_prob"]
        elif r["away_win_prob"] > r["draw_prob"]:
            favorite = f"{r['away']} (Away)"
            confidence = r["away_win_prob"]
        else:
            favorite = "Draw"
            confidence = r["draw_prob"]
        
        print(f"{i}. {r['home']} vs {r['away']}")
        print(f"   Expected: {r['home_xg']:.2f} - {r['away_xg']:.2f}")
        print(f"   Score: {r['likely_score'][0]} ({r['likely_score'][1]:.0%})")
        print(f"   🏆 Best Bet: {favorite} @ {confidence:.0%}")
        print(f"   O/U 2.5: Over {r['over_prob']:.0%} | BTTS: {r['btts_yes']:.0%}")
        print()
    
    # ---- HIGHEST CONFIDENCE BETS ----
    print("\n" + "=" * 70)
    print("🎯 HIGHEST CONFIDENCE PICKS")
    print("=" * 70)
    
    # Filter to high confidence
    high_conf = [r for r in results if max(r["home_win_prob"], r["away_win_prob"]) > 0.45]
    high_conf.sort(key=lambda x: max(x["home_win_prob"], x["away_win_prob"]), reverse=True)
    
    print("\n✅ TOP 3 BETS THIS WEEKEND:\n")
    for i, r in enumerate(high_conf[:3], 1):
        if r["home_win_prob"] > r["away_win_prob"]:
            pick = r["home"]
            prob = r["home_win_prob"]
            side = "Home Win"
        else:
            pick = r["away"]
            prob = r["away_win_prob"]
            side = "Away Win"
        
        odds = 1 / prob if prob > 0 else 999
        print(f"{i}. {pick} {side}")
        print(f"   Probability: {prob:.0%}")
        print(f"   Implied Odds: {odds:.2f}")
        print(f"   Predicted Score: {r['likely_score'][0]}")
        print()
    
    print("⚠️  Disclaimer: These are statistical predictions only.")
    print("   Gamble responsibly. 18+ only.\n")

if __name__ == "__main__":
    main()
