import { NextResponse } from 'next/server';

// Cache for API responses (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
const cache: { [key: string]: { data: any; timestamp: number } } = {};

const API_KEY = process.env.API_FOOTBALL_KEY || '787be902827858484aedb7d15e491426';
const API_BASE = 'https://v3.football.api-sports.io';

const LEAGUES: { [key: string]: { id: number; season: number; name: string } } = {
  premier_league: { id: 39, season: 2024, name: 'Premier League' },
  brazil: { id: 71, season: 2024, name: 'Serie A' },
  argentina: { id: 128, season: 2024, name: 'Liga Profesional' }
};

async function fetchFromAPI(endpoint: string, params: Record<string, string | number>) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set('apikey', API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  
  const response = await fetch(url.toString(), { 
    next: { revalidate: 300 }, // Cache for 5 minutes
    headers: { 'x-apisports-key': API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

function formatStandings(data: any) {
  if (!data?.response?.[0]?.league?.standings?.[0]) {
    return { teams: [], season: null };
  }
  
  const league = data.response[0].league;
  const standings = league.standings[0];
  
  return {
    teams: standings.map((t: any) => ({
      rank: t.rank,
      name: t.team.name,
      shortName: t.team.shortName || t.team.name.substring(0, 3).toUpperCase(),
      logo: t.team.logo,
      played: t.played,
      won: t.won,
      drawn: t.draw || t.drawn,
      lost: t.lost,
      goalsFor: t.goalsFor,
      goalsAgainst: t.goalsAgainst,
      goalDifference: t.goalsDiff,
      points: t.points,
      form: t.form || ''
    })),
    season: league.season,
    leagueName: league.name,
    leagueLogo: league.logo
  };
}

function formatFixtures(data: any) {
  return data.response?.map((m: any) => ({
    id: m.fixture.id,
    date: m.fixture.date?.substring(0, 10),
    time: m.fixture.date?.substring(11, 16),
    round: m.league.round,
    homeTeam: {
      id: m.teams.home.id,
      name: m.teams.home.name,
      logo: m.teams.home.logo
    },
    awayTeam: {
      id: m.teams.away.id,
      name: m.teams.away.name,
      logo: m.teams.away.logo
    },
    status: m.fixture.status?.short,
    goalsHome: m.goals?.home,
    goalsAway: m.goals?.away
  })) || [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league') || 'premier_league';
  const type = searchParams.get('type') || 'standings'; // standings or fixtures
  
  const cacheKey = `${league}_${type}`;
  const now = Date.now();
  
  // Check cache
  if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_DURATION) {
    return NextResponse.json(cache[cacheKey].data);
  }
  
  const leagueConfig = LEAGUES[league];
  if (!leagueConfig) {
    return NextResponse.json({ error: 'Invalid league' }, { status: 400 });
  }
  
  try {
    if (type === 'standings') {
      const data = await fetchFromAPI('standings', {
        league: leagueConfig.id,
        season: leagueConfig.season
      });
      
      const formatted = formatStandings(data);
      
      // Add note if showing old season (free tier limitation)
      if (league !== 'premier_league' && formatted.season !== 2024) {
        formatted.note = 'Showing 2024 season (latest available on free API tier)';
      }
      
      cache[cacheKey] = { data: formatted, timestamp: now };
      return NextResponse.json(formatted);
    }
    
    if (type === 'fixtures') {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const data = await fetchFromAPI('fixtures', {
        league: leagueConfig.id,
        season: leagueConfig.season,
        from: today,
        to: future,
        status: 'NS'
      });
      
      const formatted = formatFixtures(data);
      cache[cacheKey] = { data: formatted, timestamp: now };
      return NextResponse.json(formatted);
    }
    
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}