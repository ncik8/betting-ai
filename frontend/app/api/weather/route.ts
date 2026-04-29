import { NextResponse } from 'next/server';

// HK Racecourse coordinates
const VENUES = {
  'happy-valley': { lat: 22.2783, lon: 114.1747, name: 'Happy Valley' },
  'sha-tin': { lat: 22.3844, lon: 114.1878, name: 'Sha Tin' }
};

interface WeatherData {
  venue: string;
  location: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  condition: string;
  uvIndex: number;
  grassCondition: string;
  racingAdvice: string;
}

const getWindDirection = (degrees: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
};

const getCondition = (code: number): string => {
  const conditions: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Rime Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Heavy Drizzle',
    61: 'Light Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    71: 'Light Snow',
    73: 'Moderate Snow',
    75: 'Heavy Snow',
    80: 'Rain Showers',
    81: 'Moderate Showers',
    82: 'Heavy Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with Hail',
    99: 'Severe Thunderstorm'
  };
  return conditions[code] || 'Unknown';
};

const assessGrassCondition = (weather: {
  precipitation: number;
  humidity: number;
  windSpeed: number;
  condition: string;
}): { grass: string; advice: string } => {
  // Heavy rain = muddy/heavy track
  if (weather.precipitation > 10 || weather.condition.includes('Heavy Rain')) {
    return {
      grass: 'Heavy/Wet (Muddy)',
      advice: 'Inside draw bias - horses with front-running style preferred. Jockeys may take inside path.'
    };
  }
  
  if (weather.precipitation > 2 || weather.condition.includes('Rain')) {
    return {
      grass: 'Soft/Good (Wet)',
      advice: 'Favor horses with previous wet track form. Outside draw may be better for sweeping runs.'
    };
  }
  
  if (weather.humidity > 85) {
    return {
      grass: 'Good (Humid)',
      advice: 'High humidity - stamina important. Front-runners may fade late. Look for strong finishers.'
    };
  }
  
  if (weather.windSpeed > 25) {
    return {
      grass: 'Good (Windy)',
      advice: 'Strong headwind sections - favor horses that can settle mid-pack. Strong kick in stretch.'
    };
  }
  
  return {
    grass: 'Good/Fast (Fast Track)',
    advice: 'Fast track conditions - true pace bias. Draw advantage significant. Bounce runners watch out.'
  };
};

export async function GET() {
  try {
    const results: Record<string, WeatherData> = {};
    
    for (const [key, venue] of Object.entries(VENUES)) {
      // Use Open-Meteo free API (no key needed)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${venue.lat}&longitude=${venue.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&timezone=Asia/Hong_Kong`;
      
      const resp = await fetch(url, { next: { revalidate: 900 } }); // 15 min cache
      const data = await resp.json();
      
      if (data.current) {
        const condition = getCondition(data.current.weather_code);
        const grassAssessment = assessGrassCondition({
          precipitation: data.current.precipitation || 0,
          humidity: data.current.relative_humidity_2m || 0,
          windSpeed: data.current.wind_speed_10m || 0,
          condition
        });
        
        results[key] = {
          venue: venue.name,
          location: `${venue.lat}, ${venue.lon}`,
          temperature: data.current.temperature_2m || 0,
          humidity: data.current.relative_humidity_2m || 0,
          precipitation: data.current.precipitation || 0,
          windSpeed: data.current.wind_speed_10m || 0,
          windDirection: getWindDirection(data.current.wind_direction_10m || 0),
          condition,
          uvIndex: data.current.uv_index || 0,
          grassCondition: grassAssessment.grass,
          racingAdvice: grassAssessment.advice
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      data: results,
      source: 'Open-Meteo (free)',
      updated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
