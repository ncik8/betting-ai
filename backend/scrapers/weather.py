"""
Weather Scraper for HK Racing
Gets weather data for Sha Tin and Happy Valley racecourses
Uses Open-Meteo (free, no API key required)
"""

import httpx
from datetime import datetime
from typing import Optional

# Venue coordinates
VENUES = {
    "Sha Tin": {"lat": 22.4167, "lon": 114.1833},
    "Happy Valley": {"lat": 22.2753, "lon": 114.1833}
}

# Hong Kong weather codes mapping
WEATHER_CODES = {
    0: "Clear",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Light Drizzle",
    53: "Drizzle",
    55: "Heavy Drizzle",
    61: "Light Rain",
    63: "Rain",
    65: "Heavy Rain",
    71: "Light Snow",
    73: "Snow",
    75: "Heavy Snow",
    80: "Light Showers",
    81: "Showers",
    82: "Heavy Showers",
    95: "Thunderstorm",
    96: "Thunderstorm",
    99: "Thunderstorm"
}

class WeatherScraper:
    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1/forecast"
        self.session = httpx.AsyncClient(timeout=30.0)
    
    async def get_current_weather(self, venue: str) -> dict:
        """Get current weather for a venue"""
        coords = VENUES.get(venue, VENUES["Sha Tin"])
        
        params = {
            "latitude": coords["lat"],
            "longitude": coords["lon"],
            "current": ["temperature_2m", "relative_humidity_2m", "precipitation", 
                       "weather_code", "wind_speed_10m", "wind_direction_10m"],
            "timezone": "Asia/Hong_Kong"
        }
        
        try:
            response = await self.session.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_current(data.get("current", {}))
        except Exception as e:
            print(f"Error fetching weather: {e}")
            return self._mock_weather(venue)
    
    async def get_forecast(self, venue: str, hours: int = 24) -> list:
        """Get hourly forecast"""
        coords = VENUES.get(venue, VENUES["Sha Tin"])
        
        params = {
            "latitude": coords["lat"],
            "longitude": coords["lon"],
            "hourly": ["temperature_2m", "precipitation", "weather_code", 
                      "wind_speed_10m", "wind_gusts_10m"],
            "forecast_hours": hours,
            "timezone": "Asia/Hong_Kong"
        }
        
        try:
            response = await self.session.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_forecast(data.get("hourly", {}))
        except Exception as e:
            print(f"Error fetching forecast: {e}")
            return []
    
    async def get_race_day_weather(self, venue: str, race_time: str) -> dict:
        """Get weather prediction for a specific race time"""
        forecast = await self.get_forecast(venue, hours=48)
        
        # Find closest forecast to race time
        for f in forecast:
            if f["time"][11:16] == race_time:
                return f
        
        # Return current if exact match not found
        return await self.get_current_weather(venue)
    
    def _parse_current(self, current: dict) -> dict:
        """Parse current weather data"""
        weather_code = current.get("weather_code", 0)
        
        return {
            "temperature": current.get("temperature_2m", 20),
            "humidity": current.get("relative_humidity_2m", 70),
            "precipitation": current.get("precipitation", 0),
            "weather": WEATHER_CODES.get(weather_code, "Unknown"),
            "weather_code": weather_code,
            "wind_speed": current.get("wind_speed_10m", 10),
            "wind_direction": current.get("wind_direction_10m", "N"),
            "timestamp": datetime.now().isoformat()
        }
    
    def _parse_forecast(self, hourly: dict) -> list:
        """Parse hourly forecast data"""
        forecasts = []
        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        precips = hourly.get("precipitation", [])
        codes = hourly.get("weather_code", [])
        winds = hourly.get("wind_speed_10m", [])
        gusts = hourly.get("wind_gusts_10m", [])
        
        for i, t in enumerate(times):
            forecasts.append({
                "time": t,
                "temperature": temps[i] if i < len(temps) else 20,
                "precipitation": precips[i] if i < len(precips) else 0,
                "weather": WEATHER_CODES.get(codes[i] if i < len(codes) else 0, "Unknown"),
                "weather_code": codes[i] if i < len(codes) else 0,
                "wind_speed": winds[i] if i < len(winds) else 10,
                "wind_gusts": gusts[i] if i < len(gusts) else 15
            })
        
        return forecasts
    
    def _mock_weather(self, venue: str) -> dict:
        """Return mock weather data"""
        return {
            "temperature": 24,
            "humidity": 65,
            "precipitation": 0,
            "weather": "Partly Cloudy",
            "weather_code": 2,
            "wind_speed": 15,
            "wind_direction": "NE",
            "timestamp": datetime.now().isoformat()
        }
    
    async def close(self):
        await self.session.aclose()


# Standalone functions
async def get_venue_weather(venue: str) -> dict:
    scraper = WeatherScraper()
    try:
        return await scraper.get_current_weather(venue)
    finally:
        await scraper.close()

async def get_racing_conditions(venue: str, race_time: str = "15:00") -> dict:
    """Get full racing conditions for a venue"""
    scraper = WeatherScraper()
    try:
        weather = await scraper.get_race_day_weather(venue, race_time)
        return {
            "venue": venue,
            "race_time": race_time,
            "weather": weather,
            "racing_suitability": calculate_racing_suitability(weather)
        }
    finally:
        await scraper.close()


def calculate_racing_suitability(weather: dict) -> str:
    """Calculate if weather conditions are suitable for racing"""
    precip = weather.get("precipitation", 0)
    wind = weather.get("wind_speed", 0)
    code = weather.get("weather_code", 0)
    
    # Heavy rain or thunderstorms = not ideal
    if code >= 65 or precip > 5:
        return "Poor"
    elif code >= 51 or precip > 1 or wind > 30:
        return "Moderate"
    else:
        return "Good"


if __name__ == "__main__":
    import asyncio
    
    async def test():
        for venue in ["Sha Tin", "Happy Valley"]:
            weather = await get_venue_weather(venue)
            print(f"{venue}: {weather['temperature']}°C, {weather['weather']}")
    
    asyncio.run(test())
