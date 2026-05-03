import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;

  try {
    // Fetch match details from FotMob
    const response = await fetch(
      `https://www.fotmob.com/match/${matchId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.0',
        }
      }
    );

    const html = await response.text();

    // Extract match data
    const matchData = extractMatchData(html, matchId);

    return NextResponse.json({
      success: true,
      data: matchData
    });

  } catch (error) {
    console.error('FotMob match error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch match data',
      data: getSampleMatchData(matchId)
    });
  }
}

function extractMatchData(html: string, matchId: string) {
  // Try to extract __NEXT_DATA__ from the page
  const nextDataPattern = /window\.__NEXT_DATA__\s*=\s*({.*?});/s;
  const match = html.match(nextDataPattern);

  if (match) {
    try {
      const data = JSON.parse(match[1]);
      const pageProps = data.props?.pageProps || {};

      // Try to find match details in the structure
      const matchDetails = pageProps.matchDetails || pageProps.match || pageProps;

      if (matchDetails) {
        return formatMatchDetails(matchDetails);
      }
    } catch (e) {
      console.log('Failed to parse match JSON');
    }
  }

  // Fallback: extract what we can from the HTML
  return extractFromHTML(html, matchId);
}

function formatMatchDetails(data: any) {
  return {
    matchId: data.matchId || data.id,
    homeTeam: {
      name: data.homeTeam?.name || data.homeTeamName,
      shortName: data.homeTeam?.shortName || data.homeTeamShortName,
      score: data.homeScore || data.homeTeamScore,
      formation: data.homeFormation || data.formation?.home,
      lineup: data.homeLineup || data.lineup?.home || null,
      lineupAvailable: !!(data.homeLineup || data.lineup?.home)
    },
    awayTeam: {
      name: data.awayTeam?.name || data.awayTeamName,
      shortName: data.awayTeam?.shortName || data.awayTeamShortName,
      score: data.awayScore || data.awayTeamScore,
      formation: data.awayFormation || data.formation?.away,
      lineup: data.awayLineup || data.lineup?.away || null,
      lineupAvailable: !!(data.awayLineup || data.lineup?.away)
    },
    status: data.status || data.matchStatus,
    kickoffTime: data.kickoffTime || data.date || data.startDate,
    league: data.leagueName || 'Premier League',
    venue: data.venue || null,
    referee: data.referee || null,
    keyPlayers: extractKeyPlayers(data),
    lastMeetings: data.lastMeetings || data.h2h || null
  };
}

function extractFromHTML(html: string, matchId: string) {
  // Extract team names
  const homeTeamMatch = html.match(/<span[^>]*class=["'][^"]*home[^>]*>.*?>([^<]+)</gi);
  const awayTeamMatch = html.match(/<span[^>]*class=["'][^"]*away[^>]*>.*?>([^<]+)</gi);

  // Extract formation patterns like "4-3-3" or "4-2-3-1"
  const formationMatch = html.match(/\b(\d-\d-\d|\d-\d-\d-\d)\b/);

  // Extract player names (look for common PL player name patterns)
  const playerPatterns = [
    /"playerName"\s*:\s*"([^"]+)"/g,
    /<span[^>]*class=["'][^"]*player[^>]*>.*?>([^<]+)</gi
  ];

  return {
    matchId,
    homeTeam: {
      name: 'Home Team',
      shortName: 'HOM',
      score: null,
      formation: formationMatch ? formationMatch[1] : null,
      lineup: null,
      lineupAvailable: false
    },
    awayTeam: {
      name: 'Away Team',
      shortName: 'AWY',
      score: null,
      formation: null,
      lineup: null,
      lineupAvailable: false
    },
    status: 'NS',
    kickoffTime: null,
    league: 'Premier League',
    venue: null,
    referee: null,
    keyPlayers: [],
    lastMeetings: null,
    note: 'Detailed data not available - lineup may not be published yet'
  };
}

function extractKeyPlayers(data: any): string[] {
  const players: string[] = [];

  // Try various structures for key players
  const topScorers = data.topScorers || data.topScorer || [];
  const keyPlayersData = data.keyPlayers || data.keyPlayersHome || [];

  [...topScorers, ...keyPlayersData].forEach((p: any) => {
    if (p.playerName && players.length < 10) {
      players.push(p.playerName);
    }
  });

  return players;
}

function getSampleMatchData(matchId: string) {
  // Return sample data based on match ID for testing
  const samples: { [key: string]: any } = {
    'test4': {
      matchId,
      homeTeam: {
        name: 'Aston Villa',
        shortName: 'AVL',
        score: null,
        formation: '4-2-3-1',
        lineup: null,
        lineupAvailable: false
      },
      awayTeam: {
        name: 'Tottenham',
        shortName: 'TOT',
        score: null,
        formation: '4-3-3',
        lineup: null,
        lineupAvailable: false
      },
      status: 'NS',
      kickoffTime: '2026-05-04T02:00:00',
      league: 'Premier League',
      venue: 'Villa Park',
      referee: 'Michael Oliver',
      keyPlayers: ['Ollie Watkins', 'Morgan Rogers', 'Youri Tielemans', 'James Maddison', 'Son Heung-min'],
      lastMeetings: [
        { date: '2025-10-19', home: 'Tottenham', away: 'Aston Villa', score: '2-1' },
        { date: '2025-04-06', home: 'Aston Villa', away: 'Tottenham', score: '1-0' }
      ]
    },
    'test5': {
      matchId,
      homeTeam: {
        name: 'Chelsea',
        shortName: 'CHE',
        score: null,
        formation: '4-2-3-1',
        lineup: null,
        lineupAvailable: false
      },
      awayTeam: {
        name: 'Nottm Forest',
        shortName: 'NFO',
        score: null,
        formation: '4-4-2',
        lineup: null,
        lineupAvailable: false
      },
      status: 'NS',
      kickoffTime: '2026-05-04T23:00:00',
      league: 'Premier League',
      venue: 'Stamford Bridge',
      referee: 'Anthony Taylor',
      keyPlayers: ['Cole Palmer', 'Nicolas Jackson', 'Moises Caicedo', 'Anthony Elanga', 'Chris Wood'],
      lastMeetings: [
        { date: '2025-11-02', home: 'Nottm Forest', away: 'Chelsea', score: '1-0' },
        { date: '2025-04-12', home: 'Chelsea', away: 'Nottm Forest', score: '3-0' }
      ]
    }
  };

  return samples[matchId] || {
    matchId,
    homeTeam: { name: 'Team A', shortName: 'A', score: null, formation: null, lineup: null, lineupAvailable: false },
    awayTeam: { name: 'Team B', shortName: 'B', score: null, formation: null, lineup: null, lineupAvailable: false },
    status: 'NS',
    kickoffTime: null,
    league: 'Premier League',
    venue: null,
    referee: null,
    keyPlayers: [],
    lastMeetings: null
  };
}
