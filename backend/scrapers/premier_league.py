"""
Premier League Data Scraper
Uses API-Football (RapidAPI) to fetch match data, stats, and odds
"""

import os
import httpx
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("RAPIDAPI_KEY")
BASE_URL = "https://api-football-v1.p容r4.p.rapidapi.com/v3"

class PremierLeagueScraper:
    def __init__(self):
        self.headers = {
            "X-RapidAPI-Key": API_KEY or "demo",
            "X-RapidAPI-Host": "api-football-v1.p容r4.p.rapidapi.com"
        }
        self.league_id = 39  # Premier League ID
    
    async def get_today_matches(self) -> list:
        """Get today's Premier League matches"""
        today = datetime.now().strftime("%%Y-%m-%d")
        return await self._fetch_matches(date=today)
    
    async def get_matches_by_date(self, date: str) -> list:
        """Get matches for a specific date"""
        return await self._fetch_matches(date=date)
    
    async def get_matches_by_round(self, round_num: int, season: int = 2024) -> list:
        """Get matches for a specific round (gameweek)"""
        return await self._fetch_matches(league=self.league_id, season=season, round=f"Regular Season - {round_num}")
    
    async def _fetch_matches(
        self,
        date: Optional[str] = None,
        league: int = None,
        season: int = 2024,
        round: str = None
    ) -> list:
        """Internal method to fetch matches from API"""
        if not API_KEY:
            return self._mock_matches()
        
        params = {
            "league": league or self.league_id,
            "season": season
        }
        if date:
            params["date"] = date
        if round:
            params["round"] = round
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{BASE_URL}/fixtures",
                    headers=self.headers,
                    params=params,
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", [])
            except Exception as e:
                print(f"Error fetching matches: {e}")
                return self._mock_matches()
    
    async def get_match_stats(self, fixture_id: int) -> dict:
        """Get detailed stats for a specific match"""
        if not API_KEY:
            return self._mock_stats()
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{BASE_URL}/fixtures/statistics",
                    headers=self.headers,
                    params={"fixture": fixture_id},
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", [])
            except Exception as e:
                print(f"Error fetching stats: {e}")
                return self._mock_stats()
    
    async def get_league_standings(self, season: int = 2024) -> dict:
        """Get current league standings"""
        if not API_KEY:
            return {}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{BASE_URL}/standings",
                    headers=self.headers,
                    params={"league": self.league_id, "season": season},
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", [])
            except Exception as e:
                print(f"Error fetching standings: {e}")
                return {}
    
    async def get_team_form(self, team_id: int, last: int = 5) -> list:
        """Get team's last N matches form"""
        if not API_KEY:
            return []
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{BASE_URL}/fixtures",
                    headers=self.headers,
                    params={"team": team_id, "last": last},
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", [])
            except Exception as e:
                print(f"Error fetching team form: {e}")
                return []
    
    def _mock_matches(self) -> list:
        """Return mock data when API is not available"""
        tomorrow = datetime.now() + timedelta(days=1)
        return [
            {
                "fixture": {
                    "id": 999999,
                    "date": tomorrow.isoformat(),
                    "venue": {"name": "Anfield"},
                    "status": {"short": "NS"}
                },
                "league": {"name": "Premier League", "round": "Regular Season - 20"},
                "teams": {
                    "home": {"id": 40, "name": "Liverpool", "logo": "https://example.com/liverpool.png"},
                    "away": {"id": 66, "name": "Manchester United", "logo": "https://example.com/mu.png"}
                },
                "score": {"fulltime": {"home": None, "away": None}}
            },
            {
                "fixture": {
                    "id": 999998,
                    "date": tomorrow.isoformat(),
                    "venue": {"name": "Emirates Stadium"},
                    "status": {"short": "NS"}
                },
                "league": {"name": "Premier League", "round": "Regular Season - 20"},
                "teams": {
                    "home": {"id": 42, "name": "Arsenal", "logo": "https://example.com/arsenal.png"},
                    "away": {"id": 33, "name": "Manchester City", "logo": "https://example.com/mancity.png"}
                },
                "score": {"fulltime": {"home": None, "away": None}}
            }
        ]
    
    def _mock_stats(self) -> dict:
        """Return mock stats"""
        return {
            "team_id": 40,
            "stats": [
                {"type": "Shots", "home": 15, "away": 8},
                {"type": "Shots on Goal", "home": 6, "away": 3},
                {"type": "Corners", "home": 7, "away": 4},
                {"type": "Fouls", "home": 10, "away": 12}
            ]
        }


# Standalone functions for use in other modules
async def fetch_today_matches() -> list:
    scraper = PremierLeagueScraper()
    return await scraper.get_today_matches()

async def fetch_match_stats(fixture_id: int) -> dict:
    scraper = PremierLeagueScraper()
    return await scraper.get_match_stats(fixture_id)

if __name__ == "__main__":
    import asyncio
    
    async def test():
        scraper = PremierLeagueScraper()
        matches = await scraper.get_today_matches()
        print(f"Found {len(matches)} matches")
        for m in matches:
            print(f"  {m['teams']['home']['name']} vs {m['teams']['away']['name']}")
    
    asyncio.run(test())
