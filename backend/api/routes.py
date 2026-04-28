"""
API Routes for Betting AI
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import asyncio

from ..scrapers.premier_league import PremierLeagueScraper, fetch_today_matches
from ..scrapers.hk_racing import HKRacingScraper, get_racing_day_info
from ..scrapers.weather import get_venue_weather, get_racing_conditions
from ..models.prediction_engine import PredictionOrchestrator

router = APIRouter()

# Initialize components
scraper_pl = PremierLeagueScraper()
scraper_hk = HKRacingScraper()
orchestrator = PredictionOrchestrator()

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class TeamData(BaseModel):
    name: str
    form: int = 5
    attack_strength: float = 0.5
    defense_strength: float = 0.5

class MatchPredictRequest(BaseModel):
    home_team: TeamData
    away_team: TeamData
    match_id: Optional[str] = None
    enhance: bool = True

class HorseData(BaseModel):
    name: str
    horse_number: int
    draw: int
    jockey: str
    trainer: str
    weight: int
    last_5: str  # "1-2-3-4-5" format
    rating: Optional[float] = None

class RacePredictRequest(BaseModel):
    horses: List[HorseData]
    venue: str
    race_number: int
    distance: int
    going: str = "Good"
    enhance: bool = True

# =============================================================================
# FOOTBALL ENDPOINTS
# =============================================================================

@router.get("/football/matches")
async def get_football_matches(date: Optional[str] = None):
    """Get Premier League matches for a date (defaults to today)"""
    try:
        if date:
            matches = await scraper_pl.get_matches_by_date(date)
        else:
            matches = await scraper_pl.get_today_matches()
        
        return {"matches": matches, "count": len(matches)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/football/matches/{match_id}")
async def get_football_match(match_id: int):
    """Get details for a specific match"""
    try:
        stats = await scraper_pl.get_match_stats(match_id)
        return {"match_id": match_id, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/football/predict")
async def predict_football(request: MatchPredictRequest):
    """Get AI predictions for a football match"""
    try:
        result = await orchestrator.predict_football_match(
            home_team=request.home_team.dict(),
            away_team=request.away_team.dict(),
            match_data={"match_id": request.match_id} if request.match_id else None,
            enhance=request.enhance
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/football/standings")
async def get_standings(season: int = 2024):
    """Get Premier League standings"""
    try:
        standings = await scraper_pl.get_league_standings(season)
        return {"standings": standings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# HK RACING ENDPOINTS
# =============================================================================

@router.get("/racing/today")
async def get_today_races():
    """Get today's HK races with weather"""
    try:
        info = get_racing_day_info()
        
        if not info["is_racing_day"]:
            return {
                "racing_today": False,
                "message": f"No racing today ({info['day']}). Next racing: Wednesday or Weekend.",
                "venue": None,
                "races": []
            }
        
        races = await scraper_hk.get_today_races()
        weather = await get_venue_weather(info["venue"]) if info["venue"] else None
        
        return {
            "racing_today": True,
            "venue": info["venue"],
            "weather": weather,
            "races": races,
            "count": len(races)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/racing/dates/{date}")
async def get_races_by_date(date: str):
    """Get HK races for a specific date (format: YYYY-MM-DD)"""
    try:
        races = await scraper_hk.get_races_by_date(date)
        
        # Determine venue from races
        venue = None
        if races:
            venue = races[0].get("venue")
        
        weather = await get_venue_weather(venue) if venue else None
        
        return {
            "date": date,
            "venue": venue,
            "weather": weather,
            "races": races,
            "count": len(races)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/racing/racecard/{meeting_id}/{race_num}")
async def get_race_card(meeting_id: str, race_num: int):
    """Get race card with horse details"""
    try:
        card = await scraper_hk.get_race_card(meeting_id, race_num)
        return {"race": race_num, "horses": card.get("horses", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/racing/predict")
async def predict_race(request: RacePredictRequest):
    """Get AI predictions for a horse race"""
    try:
        race_data = {
            "venue": request.venue,
            "race_number": request.race_number,
            "distance": request.distance,
            "going": request.going,
            "horses": [h.dict() for h in request.horses]
        }
        
        conditions = {"going": request.going}
        result = await orchestrator.predict_race(
            horses=[h.dict() for h in request.horses],
            race_data=race_data,
            enhance=request.enhance
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/racing/venues")
async def get_venues():
    """Get HK racing venues info"""
    return {
        "venues": [
            {"name": "Sha Tin", "description": "Main racecourse, all-weather track", "days": ["Saturday", "Sunday"]},
            {"name": "Happy Valley", "description": "City racecourse, turf track", "days": ["Wednesday"]}
        ]
    }

# =============================================================================
# WEATHER ENDPOINTS
# =============================================================================

@router.get("/weather/{venue}")
async def get_weather(venue: str):
    """Get current weather for a venue"""
    try:
        weather = await get_venue_weather(venue)
        conditions = await get_racing_conditions(venue)
        return {"weather": weather, "racing_suitability": conditions.get("racing_suitability")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# DASHBOARD ENDPOINT
# =============================================================================

@router.get("/dashboard")
async def get_dashboard():
    """Get dashboard data for today"""
    try:
        # Get PL matches
        pl_matches = await scraper_pl.get_today_matches()
        
        # Get HK races
        hk_info = get_racing_day_info()
        hk_races = await scraper_hk.get_today_races() if hk_info["is_racing_day"] else []
        hk_weather = await get_venue_weather(hk_info["venue"]) if hk_info["venue"] else None
        
        return {
            "date": datetime.now().isoformat()[:10],
            "football": {
                "has_matches": len(pl_matches) > 0,
                "count": len(pl_matches),
                "matches": pl_matches[:5]  # Limit for dashboard
            },
            "horse_racing": {
                "is_racing_day": hk_info["is_racing_day"],
                "venue": hk_info["venue"],
                "weather": hk_weather,
                "races": hk_races[:5] if hk_races else []
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
