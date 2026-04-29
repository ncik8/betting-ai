"""
Sofascore API integration for Brazil Serie A and Argentina Liga Profesional.
Uses sofascore_wrapper library + direct API calls to bypass broken methods.
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from functools import partial

# Use direct API approach since sofascore_wrapper has bugs
BASE_URL = "https://www.sofascore.com/api/v1"

# Tournament and season IDs
TOURNAMENTS = {
    "brazil": {
        "id": 325,
        "season_id": 87678,
        "name": "Brasileirão Betano",
        "current_round": 13,  # Will be fetched dynamically
    },
    "argentina": {
        "id": 155,
        "season_id": 87913,
        "name": "Primera LPF",
        "current_round": 16,  # Will be fetched dynamically
    }
}

class SofascoreBrowser:
    """Browser-based API caller using Playwright."""
    
    def __init__(self):
        self.browser = None
        self.page = None
        self.playwright = None
    
    async def _init_browser(self):
        if self.playwright is None:
            from playwright.async_api import async_playwright
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.page = await self.browser.new_page()
    
    async def _get(self, endpoint: str) -> dict:
        await self._init_browser()
        url = f"{BASE_URL}{endpoint}"
        response = await self.page.goto(url)
        if response.status == 200:
            return await response.json()
        else:
            raise Exception(f"Failed to fetch {endpoint}: {response.status}")
    
    async def close(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


async def get_current_round(tournament_id: int, season_id: int) -> int:
    """Get the current round number for a tournament."""
    api = SofascoreBrowser()
    try:
        data = await api._get(f"/unique-tournament/{tournament_id}/season/{season_id}/rounds")
        current = data.get("currentRound", {})
        return current.get("round", 1)
    finally:
        await api.close()


async def get_standings(tournament_id: int, season_id: int) -> List[Dict]:
    """Get live standings for a tournament."""
    api = SofascoreBrowser()
    try:
        data = await api._get(f"/unique-tournament/{tournament_id}/season/{season_id}/standings/total")
        standings = []
        
        # Navigate through the standings structure: data["standings"][0]["rows"]
        # Argentina has multiple groups (zones), take first "total" group
        standings_list = data.get("standings", [])
        rows = []
        for group in standings_list:
            if group.get("type") == "total":
                rows = group.get("rows", [])
                # Take first group with reasonable row count (15 for Argentina, 20 for Brazil)
                if len(rows) >= 15:
                    break
        
        for row in rows:
            team = row.get("team", {})
            rankings = {
                "rank": row.get("position", 0),
                "team": team.get("name", "Unknown"),
                "shortName": team.get("shortName", ""),
                "played": row.get("matches", 0),
                "won": row.get("wins", 0),
                "drawn": row.get("draws", 0),
                "lost": row.get("losses", 0),
                "goalsFor": row.get("scoresFor", 0),
                "goalsAgainst": row.get("scoresAgainst", 0),
                "points": row.get("points", 0),
            }
            # Calculate goal difference
            rankings["goalDiff"] = rankings["goalsFor"] - rankings["goalsAgainst"]
            standings.append(rankings)
        
        # Sort by rank
        standings.sort(key=lambda x: x["rank"])
        return standings
    finally:
        await api.close()


async def get_fixtures(tournament_id: int, season_id: int, round_num: int) -> List[Dict]:
    """Get fixtures for a specific round."""
    api = SofascoreBrowser()
    try:
        # Use /events/round/{round} endpoint (not the broken /round/{round})
        data = await api._get(f"/unique-tournament/{tournament_id}/season/{season_id}/events/round/{round_num}")
        events = data.get("events", [])
        
        fixtures = []
        for e in events:
            home = e.get("homeTeam", {})
            away = e.get("awayTeam", {})
            timestamp = e.get("startTimestamp", 0)
            
            fixture = {
                "id": e.get("id", 0),
                "homeTeam": home.get("name", "Unknown"),
                "awayTeam": away.get("name", "Unknown"),
                "homeShort": home.get("shortName", ""),
                "awayShort": away.get("shortName", ""),
                "status": e.get("status", {}).get("description", "Unknown"),
                "statusCode": e.get("status", {}).get("code", -1),
                "timestamp": timestamp,
                "date": datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M") if timestamp else "TBD",
                "round": e.get("roundInfo", {}).get("round", round_num),
            }
            
            # Add scores if available
            home_score = e.get("homeScore", {})
            away_score = e.get("awayScore", {})
            fixture["homeScore"] = home_score.get("current", 0)
            fixture["awayScore"] = away_score.get("current", 0)
            fixture["ftScore"] = f"{fixture['homeScore']}-{fixture['awayScore']}"
            
            # Halftime
            fixture["htScore"] = f"{home_score.get('period1', 0)}-{away_score.get('period1', 0)}"
            
            fixtures.append(fixture)
        
        return fixtures
    finally:
        await api.close()


async def get_next_round_fixtures(tournament_id: int, season_id: int) -> tuple[int, List[Dict]]:
    """Get fixtures for the next upcoming round. Returns (round_num, fixtures)."""
    api = SofascoreBrowser()
    try:
        # Get current round
        rounds_data = await api._get(f"/unique-tournament/{tournament_id}/season/{season_id}/rounds")
        current_round = rounds_data.get("currentRound", {}).get("round", 1)
        all_rounds = rounds_data.get("rounds", [])
        
        # Find the next round with "Not started" fixtures
        for r in all_rounds:
            round_num = r.get("round", 0)
            if round_num < current_round:
                continue
            
            # Check this round's fixtures
            fixtures_data = await api._get(f"/unique-tournament/{tournament_id}/season/{season_id}/events/round/{round_num}")
            events = fixtures_data.get("events", [])
            
            # Check if any fixtures are "Not started"
            has_upcoming = any(e.get("status", {}).get("code") == 0 for e in events)
            
            if has_upcoming:
                fixtures = []
                for e in events:
                    home = e.get("homeTeam", {})
                    away = e.get("awayTeam", {})
                    timestamp = e.get("startTimestamp", 0)
                    
                    fixture = {
                        "id": e.get("id", 0),
                        "homeTeam": home.get("name", "Unknown"),
                        "awayTeam": away.get("name", "Unknown"),
                        "homeShort": home.get("shortName", ""),
                        "awayShort": away.get("shortName", ""),
                        "status": e.get("status", {}).get("description", "Unknown"),
                        "statusCode": e.get("status", {}).get("code", -1),
                        "timestamp": timestamp,
                        "date": datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M") if timestamp else "TBD",
                        "round": round_num,
                    }
                    
                    # Add scores if available
                    home_score = e.get("homeScore", {})
                    away_score = e.get("awayScore", {})
                    fixture["homeScore"] = home_score.get("current", 0)
                    fixture["awayScore"] = away_score.get("current", 0)
                    fixture["ftScore"] = f"{fixture['homeScore']}-{fixture['awayScore']}"
                    fixture["htScore"] = f"{home_score.get('period1', 0)}-{away_score.get('period1', 0)}"
                    
                    fixtures.append(fixture)
                
                return round_num, fixtures
        
        # No upcoming fixtures found, return current round
        return current_round, []
    finally:
        await api.close()


async def get_brazil_data() -> Dict:
    """Get all Brazil Serie A data."""
    t = TOURNAMENTS["brazil"]
    
    # Get standings
    standings = await get_standings(t["id"], t["season_id"])
    
    # Get next round fixtures
    next_round, fixtures = await get_next_round_fixtures(t["id"], t["season_id"])
    
    return {
        "league": "brazil",
        "name": t["name"],
        "current_round": next_round,
        "standings": standings,
        "next_fixtures": fixtures,
        "updated": datetime.now().isoformat()
    }


async def get_argentina_data() -> Dict:
    """Get all Argentina Liga Profesional data."""
    t = TOURNAMENTS["argentina"]
    
    # Get standings
    standings = await get_standings(t["id"], t["season_id"])
    
    # Get next round fixtures
    next_round, fixtures = await get_next_round_fixtures(t["id"], t["season_id"])
    
    return {
        "league": "argentina",
        "name": t["name"],
        "current_round": next_round,
        "standings": standings,
        "next_fixtures": fixtures,
        "updated": datetime.now().isoformat()
    }


async def get_league_data(league: str) -> Dict:
    """Get data for a specific league."""
    if league == "brazil":
        return await get_brazil_data()
    elif league == "argentina":
        return await get_argentina_data()
    else:
        raise ValueError(f"Unknown league: {league}")


# CLI for testing
if __name__ == "__main__":
    async def main():
        print("=== Brazil Serie A ===")
        br = await get_brazil_data()
        print(f"League: {br['name']}")
        print(f"Current Round: {br['current_round']}")
        print(f"\nStandings (Top 5):")
        for s in br["standings"][:5]:
            print(f"  {s['rank']}. {s['team']} - {s['points']}pts")
        print(f"\nNext Round ({br['current_round']+1}) Fixtures ({len(br['next_fixtures'])} matches):")
        for f in br["next_fixtures"][:5]:
            print(f"  {f['homeTeam']} vs {f['awayTeam']}")
        
        print("\n\n=== Argentina Liga Profesional ===")
        ar = await get_argentina_data()
        print(f"League: {ar['name']}")
        print(f"Current Round: {ar['current_round']}")
        print(f"\nStandings (Top 5):")
        for s in ar["standings"][:5]:
            print(f"  {s['rank']}. {s['team']} - {s['points']}pts")
        print(f"\nNext Round ({ar['current_round']+1}) Fixtures ({len(ar['next_fixtures'])} matches):")
        for f in ar["next_fixtures"][:5]:
            print(f"  {f['homeTeam']} vs {f['awayTeam']}")
    
    asyncio.run(main())
