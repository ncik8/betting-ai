"""
API-Football Integration
Provides live data for PL, Brazil, and Argentina
Free tier: 2024 season data only for South America
"""

import os
import json
import httpx
from datetime import datetime, timedelta
from typing import Optional

# API Configuration
API_KEY = os.getenv("API_FOOTBALL_KEY", "787be902827858484aedb7d15e491426")
API_BASE = "https://v3.football.api-sports.io"

# League IDs
LEAGUES = {
    "premier_league": {"id": 39, "season": 2025, "name": "Premier League"},
    "brazil": {"id": 71, "season": 2024, "name": "Serie A"},
    "argentina": {"id": 128, "season": 2024, "name": "Liga Profesional"}
}

# Cache file
CACHE_DIR = os.path.join(os.path.dirname(__file__), "../../data/cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def get_cache_path(league_key: str, data_type: str) -> str:
    return os.path.join(CACHE_DIR, f"{league_key}_{data_type}.json")

def is_cache_valid(league_key: str, data_type: str, max_age_hours: int = 6) -> bool:
    """Check if cache exists and is still valid"""
    cache_path = get_cache_path(league_key, data_type)
    if not os.path.exists(cache_path):
        return False
    
    # Check file age
    file_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(cache_path))
    return file_age < timedelta(hours=max_age_hours)

def save_cache(league_key: str, data_type: str, data: dict) -> None:
    """Save data to cache"""
    cache_path = get_cache_path(league_key, data_type)
    with open(cache_path, 'w') as f:
        json.dump({"timestamp": datetime.now().isoformat(), "data": data}, f)

def load_cache(league_key: str, data_type: str) -> Optional[dict]:
    """Load data from cache if valid"""
    if not is_cache_valid(league_key, data_type):
        return None
    
    cache_path = get_cache_path(league_key, data_type)
    with open(cache_path, 'r') as f:
        return json.load(f)["data"]
    return None

async def fetch_api(endpoint: str, params: dict) -> dict:
    """Make API request with caching"""
    url = f"{API_BASE}/{endpoint}"
    headers = {"x-apisports-key": API_KEY}
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, headers=headers, timeout=30.0)
        response.raise_for_status()
        return response.json()

def format_standings(api_data: dict, league_key: str) -> dict:
    """Transform API standings into our format"""
    if not api_data.get("response") or not api_data["response"][0].get("league", {}).get("standings"):
        return {"teams": [], "season": None}
    
    league = api_data["response"][0]["league"]
    standings = league["standings"][0]  # First (and usually only) standings table
    
    teams = []
    for team in standings:
        teams.append({
            "rank": team["rank"],
            "name": team["team"]["name"],
            "shortName": team["team"]["shortName"] if "shortName" in team["team"] else team["team"]["name"][:3].upper(),
            "logo": team["team"]["logo"],
            "played": team["played"],
            "won": team["won"],
            "drawn": team["draw"],
            "lost": team["lost"],
            "goalsFor": team["goalsFor"],
            "goalsAgainst": team["goalsAgainst"],
            "goalDifference": team["goalsDiff"],
            "points": team["points"],
            "form": team.get("form", "")
        })
    
    return {
        "teams": teams,
        "season": league.get("season"),
        "leagueName": league.get("name"),
        "leagueLogo": league.get("logo")
    }

def format_fixtures(api_data: dict) -> list:
    """Transform API fixtures into our format"""
    fixtures = []
    for match in api_data.get("response", []):
        fixture = match["fixture"]
        teams = match["teams"]
        league = match["league"]
        
        fixtures.append({
            "id": fixture["id"],
            "date": fixture["date"][:10],  # YYYY-MM-DD
            "time": fixture["date"][11:16],  # HH:MM
            "timestamp": fixture["timestamp"],
            "round": league.get("round", ""),
            "homeTeam": {
                "id": teams["home"]["id"],
                "name": teams["home"]["name"],
                "logo": teams["home"]["logo"]
            },
            "awayTeam": {
                "id": teams["away"]["id"],
                "name": teams["away"]["name"],
                "logo": teams["away"]["logo"]
            },
            "status": fixture["status"]["short"],
            "goalsHome": match["goals"].get("home"),
            "goalsAway": match["goals"].get("away")
        })
    
    return fixtures

async def get_standings(league_key: str, force_refresh: bool = False) -> dict:
    """Get standings for a league, using cache if available"""
    cache_data = None if force_refresh else load_cache(league_key, "standings")
    
    if cache_data:
        return cache_data
    
    league = LEAGUES.get(league_key)
    if not league:
        return {"error": f"Unknown league: {league_key}"}
    
    try:
        data = await fetch_api("standings", {
            "league": league["id"],
            "season": league["season"]
        })
        
        if data.get("results", 0) > 0:
            formatted = format_standings(data, league_key)
            save_cache(league_key, "standings", formatted)
            return formatted
        else:
            # Try previous season if current fails
            if league["season"] > 2020:
                old_season = league["season"]
                league["season"] = old_season - 1
                data = await fetch_api("standings", {
                    "league": league["id"],
                    "season": league["season"]
                })
                if data.get("results", 0) > 0:
                    formatted = format_standings(data, league_key)
                    formatted["note"] = f"Showing {league['season']} season (latest available on free tier)"
                    save_cache(league_key, "standings", formatted)
                    return formatted
            return {"error": "No standings data available", "details": data.get("errors", {})}
    except Exception as e:
        return {"error": str(e)}

async def get_fixtures(league_key: str, next_n: int = 10, force_refresh: bool = False) -> list:
    """Get upcoming fixtures for a league"""
    cache_data = None if force_refresh else load_cache(league_key, "fixtures")
    
    if cache_data:
        return cache_data
    
    league = LEAGUES.get(league_key)
    if not league:
        return []
    
    try:
        # Get current date and date 14 days from now
        today = datetime.now().strftime("%Y-%m-%d")
        future = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        
        data = await fetch_api("fixtures", {
            "league": league["id"],
            "season": league["season"],
            "from": today,
            "to": future,
            "status": "NS"  # Not Started
        })
        
        fixtures = format_fixtures(data)
        save_cache(league_key, "fixtures", fixtures)
        return fixtures[:next_n]
    except Exception as e:
        print(f"Error fetching fixtures: {e}")
        return []

async def get_live_scores(league_key: str) -> list:
    """Get live/in-progress matches"""
    league = LEAGUES.get(league_key)
    if not league:
        return []
    
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        data = await fetch_api("fixtures", {
            "league": league["id"],
            "season": league["season"],
            "from": today,
            "to": today,
            "status": "1H,2H,HT,ET,P"  # Live statuses
        })
        return format_fixtures(data)
    except Exception as e:
        print(f"Error fetching live scores: {e}")
        return []

async def get_h2h(home_id: int, away_id: int, last_n: int = 5) -> dict:
    """Get head-to-head history between two teams"""
    try:
        data = await fetch_api("fixtures", {
            "team": home_id,
            "vs": away_id,
            "last": last_n
        })
        return {"fixtures": format_fixtures(data), "count": data.get("results", 0)}
    except Exception as e:
        return {"error": str(e), "fixtures": []}

# Standalone functions for use in API routes
async def get_all_standings() -> dict:
    """Get standings for all leagues"""
    results = {}
    for league_key in LEAGUES:
        results[league_key] = await get_standings(league_key)
    return results

async def get_all_fixtures() -> dict:
    """Get fixtures for all leagues"""
    results = {}
    for league_key in LEAGUES:
        results[league_key] = await get_fixtures(league_key)
    return results

if __name__ == "__main__":
    import asyncio
    
    async def test():
        print("Testing API-Football integration...")
        
        # Test PL standings
        print("\n=== Premier League ===")
        pl = await get_standings("premier_league")
        if "teams" in pl:
            for t in pl["teams"][:5]:
                print(f"{t['rank']}. {t['name']} - {t['points']}pts")
        else:
            print(f"Error: {pl.get('error')}")
        
        # Test Brazil
        print("\n=== Brazil Serie A ===")
        br = await get_standings("brazil")
        if "teams" in br:
            for t in br["teams"][:5]:
                print(f"{t['rank']}. {t['name']} - {t['points']}pts")
            if br.get("note"):
                print(f"Note: {br['note']}")
        else:
            print(f"Error: {br.get('error')}")
        
        # Test Argentina
        print("\n=== Argentina ===")
        ar = await get_standings("argentina")
        if "teams" in ar:
            for t in ar["teams"][:5]:
                print(f"{t['rank']}. {t['name']} - {t['points']}pts")
        else:
            print(f"Error: {ar.get('error')}")
        
        # Test fixtures
        print("\n=== PL Fixtures ===")
        fixtures = await get_fixtures("premier_league")
        for f in fixtures[:3]:
            print(f"{f['date']} {f['time']} - {f['homeTeam']['name']} vs {f['awayTeam']['name']}")
    
    asyncio.run(test())