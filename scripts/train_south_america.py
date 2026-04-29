import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import json
import warnings
warnings.filterwarnings('ignore')

def train_south_american_models(league_name, file_path):
    df = pd.read_csv(file_path, encoding='utf-8-sig')
    df['Date'] = pd.to_datetime(df['Date'], format='%d/%m/%Y', errors='coerce')
    df = df.dropna(subset=['Date', 'HG', 'AG', 'Res'])
    
    le = LabelEncoder()
    df['Result_encoded'] = le.fit_transform(df['Res'])
    
    df['HomeGoals'] = pd.to_numeric(df['HG'], errors='coerce').fillna(0)
    df['AwayGoals'] = pd.to_numeric(df['AG'], errors='coerce').fillna(0)
    df['TotalGoals'] = df['HomeGoals'] + df['AwayGoals']
    df['BTTS'] = ((df['HomeGoals'] > 0) & (df['AwayGoals'] > 0)).astype(int)
    
    X = df[['HomeGoals', 'AwayGoals']]
    
    results = {'league': league_name, 'total_matches': len(df), 'seasons': len(df['Season'].unique()), 'models': {}}
    
    # 1X2
    clf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
    clf.fit(X, df['Result_encoded'])
    # Typical home vs away scenario
    probs = clf.predict_proba([[1.5, 1.0]])[0]
    classes = list(clf.classes_)
    home_idx = classes.index(le.transform(['H'])[0]) if 'H' in le.classes_ else 0
    draw_idx = classes.index(le.transform(['D'])[0]) if 'D' in le.classes_ else 1
    away_idx = classes.index(le.transform(['A'])[0]) if 'A' in le.classes_ else 2
    results['models']['1X2'] = {
        'home': round(float(probs[home_idx]) * 100, 1),
        'draw': round(float(probs[draw_idx]) * 100, 1),
        'away': round(float(probs[away_idx]) * 100, 1)
    }
    
    # Over/Under 2.5
    df['Over25'] = (df['TotalGoals'] > 2.5).astype(int)
    clf_ou = RandomForestClassifier(n_estimators=50, max_depth=4, random_state=42)
    clf_ou.fit(X, df['Over25'])
    results['models']['Over25'] = {'over': round(float(clf_ou.predict_proba([[1.5, 1.0]])[0][1]) * 100, 1)}
    
    # BTTS
    clf_btts = RandomForestClassifier(n_estimators=50, max_depth=4, random_state=42)
    clf_btts.fit(X, df['BTTS'])
    results['models']['BTTS'] = {'yes': round(float(clf_btts.predict_proba([[1.5, 1.0]])[0][1]) * 100, 1)}
    
    # Avg goals
    results['avg_total_goals'] = round(df['TotalGoals'].mean(), 2)
    results['avg_home_goals'] = round(df['HomeGoals'].mean(), 2)
    results['avg_away_goals'] = round(df['AwayGoals'].mean(), 2)
    
    print(f"✓ {league_name}: {len(df)} matches across {len(df['Season'].unique())} seasons")
    return results

print("Training South American ML models...\n")
brazil = train_south_american_models('Brazil Serie A', 'data/south_america/brasil.csv')
argentina = train_south_american_models('Argentina Liga Profesional', 'data/south_america/argentina.csv')

with open('data/south_america/models.json', 'w') as f:
    json.dump({'brazil': brazil, 'argentina': argentina}, f, indent=2)

print("\n✓ Saved to data/south_america/models.json")