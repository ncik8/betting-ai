"""
FastAPI routes for South American football data via Sofascore.
"""
from fastapi import APIRouter, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import os

from .sofascore_api import get_brazil_data, get_argentina_data, get_league_data

router = APIRouter()

# Add CORS
router.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@router.get("/api/sofascore/brazil")
async def brazil_data():
    """Get Brazil Serie A data."""
    try:
        import asyncio
        data = asyncio.run(get_brazil_data())
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/api/sofascore/argentina")
async def argentina_data():
    """Get Argentina Liga Profesional data."""
    try:
        import asyncio
        data = asyncio.run(get_argentina_data())
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/api/sofascore/{league}")
async def league_data(league: str):
    """Get data for a specific league (brazil or argentina)."""
    try:
        import asyncio
        data = asyncio.run(get_league_data(league))
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}
