"""
HK Horse Racing Scraper
Scrapes HKJC race cards and horse data for Sha Tin and Happy Valley
"""

import os
import httpx
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
from typing import Optional
from dotenv import load_dotenv
import asyncio

load_dotenv()

# HKJC Race Card URLs
HKJC_BASE_URL = "https://racing.hkjf.com"
SHA_TIN_VENUE = "Sha Tin"
HAPPY_VALLEY_VENUE = "Happy Valley"

class HKRacingScraper:
    def __init__(self):
        self.session = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            timeout=30.0
        )
    
    async def get_today_races(self) -> list:
        """Get today's HK races"""
        today = datetime.now().strftime("%%Y-%%m-%%d")
        return await self._fetch_races(date=today)
    
    async def get_races_by_date(self, date: str) -> list:
        """Get races for a specific date"""
        return await self._fetch_races(date=date)
    
    async def get_race_card(self, meeting_id: str, race_num: int) -> dict:
        """Get detailed race card for a specific race"""
        url = f"{HKJC_BASE_URL}/rc/card/ajax/getRaceCard"
        params = {"meetingId": meeting_id, "raceNo": race_num}
        
        try:
            response = await self.session.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching race card: {e}")
            return self._mock_race_card(race_num)
    
    async def _fetch_races(self, date: str) -> list:
        """Fetch races from HKJC"""
        # HKJC uses a different URL structure for race meetings
        url = f"{HKJC_BASE_URL}/rc/ajax/meeting"
        params = {"date": date.replace("-", "")}
        
        try:
            response = await self.session.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_meetings(data)
        except Exception as e:
            print(f"Error fetching races: {e}")
            return self._mock_races()
    
    def _parse_meetings(self, data: dict) -> list:
        """Parse HKJC API response into normalized format"""
        races = []
        meetings = data.get("meetings", [])
        
        for meeting in meetings:
            venue = meeting.get("venueName", "")
            if "Sha Tin" in venue:
                venue = SHA_TIN_VENUE
            elif "Happy Valley" in venue:
                venue = HAPPY_VALLEY_VENUE
            
            for race in meeting.get("races", []):
                races.append({
                    "id": f"{meeting.get('id')}_{race.get('raceNo')}",
                    "meeting_id": meeting.get("id"),
                    "venue": venue,
                    "race_number": race.get("raceNo"),
                    "race_time": race.get("raceTime", "")[:5],  # HH:MM format
                    "distance": race.get("distance", 0),
                    "going": meeting.get("going", ""),
                    "class": race.get("class", ""),
                    "prize": race.get("prize", ""),
                })
        
        return races
    
    async def get_horse_details(self, horse_id: str) -> dict:
        """Get detailed horse information"""
        url = f"{HKJC_BASE_URL}/rc/horse/{horse_id}"
        
        try:
            response = await self.session.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "lxml")
            return self._parse_horse_page(soup)
        except Exception as e:
            print(f"Error fetching horse: {e}")
            return {}
    
    def _parse_horse_page(self, soup: BeautifulSoup) -> dict:
        """Parse horse details from HKJC page"""
        name = soup.select_one(".horse-name")
        info = soup.select_one(".horse-info")
        
        return {
            "name": name.text.strip() if name else "",
            "info": info.text.strip() if info else "",
        }
    
    def _mock_races(self) -> list:
        """Return mock data when API is not available"""
        today = datetime.now()
        is_wednesday = today.weekday() == 2  # Wed = Happy Valley
        
        venue = HAPPY_VALLEY_VENUE if is_wednesday else SHA_TIN_VENUE
        
        races = []
        for i in range(1, 11):
            races.append({
                "id": f"mock_{venue}_{i}",
                "venue": venue,
                "race_number": i,
                "race_time": f"{14 + i//2:02d}:{30 if i % 2 == 0 else 0:02d}",
                "distance": [1200, 1400, 1600, 1800, 2000, 2200, 1000, 1200, 1400, 1600][i-1],
                "going": "Good",
                "class": f"Class {4 - (i % 4)}",
                "prize": f"${1000000 - i * 50000}",
            })
        
        return races
    
    def _mock_race_card(self, race_num: int) -> dict:
        """Mock race card with horses"""
        horses = []
        horse_names = [
            "Champion Star", "Lucky Express", "Golden Power", "Thunder Bolt",
            "Happy Days", "Victory March", "Flying Dragon", "Smart Choice",
            "Big Boss", "Super Sonic", "Mighty Mouse", "Fast Track"
        ]
        
        for i, name in enumerate(horse_names[:12], 1):
            horses.append({
                "horse_number": i,
                "name": f"{name} {i}",
                "draw": i,
                "jockey": f"Jockey {i}",
                "trainer": f"Trainer {i}",
                "weight": 1150 + i * 10,
                "last_5": f"{i}-{(i*2)%5+1}-{(i*3)%5+1}-{(i*4)%5+1}-{(i*5)%5+1}",
                "rating": 85 + i,
            })
        
        return {"horses": horses}
    
    async def close(self):
        await self.session.aclose()


# Standalone functions
async def fetch_today_races() -> list:
    scraper = HKRacingScraper()
    try:
        return await scraper.get_today_races()
    finally:
        await scraper.close()

async def fetch_race_card(meeting_id: str, race_num: int) -> dict:
    scraper = HKRacingScraper()
    try:
        return await scraper.get_race_card(message_id, race_num)
    finally:
        await scraper.close()


# Check if racing today
def get_racing_day_info() -> dict:
    """Get venue info based on day of week"""
    today = datetime.now()
    weekday = today.weekday()
    
    # HK Racing days: Wednesday (Happy Valley), Sat/Sun (Sha Tin)
    if weekday == 2:  # Wednesday
        return {"day": "Wednesday", "venue": HAPPY_VALLEY_VENUE, "is_racing_day": True}
    elif weekday in [5, 6]:  # Saturday, Sunday
        return {"day": "Weekend", "venue": SHA_TIN_VENUE, "is_racing_day": True}
    else:
        return {"day": today.strftime("%%A"), "venue": None, "is_racing_day": False}


if __name__ == "__main__":
    async def test():
        info = get_racing_day_info()
        print(f"Today: {info}")
        
        scraper = HKRacingScraper()
        races = await scraper.get_today_races()
        print(f"Found {len(races)} races")
        
        await scraper.close()
    
    asyncio.run(test())
