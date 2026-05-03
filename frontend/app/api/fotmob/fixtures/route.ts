import { NextResponse } from 'next/server';

// PL league ID on FotMob is 47
const FOTMOB_PL_LEAGUE_ID = 47;

export async function GET() {
  try {
    // Fetch PL overview page to get match IDs
    const response = await fetch(
      `https://www.fotmob.com/leagues/${FOTMOB_PL_LEAGUE_ID}/overview/premier-league`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      }
    );

    const html = await response.text();

    // Extract match data from the page
    // FotMob embeds match data in JSON scripts
    const matches: any[] = [];

    // Look for match data patterns in the HTML
    // Format: {"id":12345,"homeTeam":"Arsenal","awayTeam":"Fulham"...}
    const matchIdPattern = /"matchId"\s*:\s*(\d+)/g;
    const teamNamePattern = /"homeTeam"\s*:\s*"([^"]+)"|"awayTeam"\s*:\s*"([^"]+)"/g;
    const scorePattern = /"score"\s*:\s*"(\d+)"/g;
    const statusPattern = /"status"\s*:\s*"([^"]+)"/g;
    const timePattern = /"time"\s*:\s*"([^"]+)"|"kickoffTime"\s*:\s*"([^"]+)"|"date"\s*:\s*"([^"]+)"/g;

    // Try to find embedded JSON data
    const jsonDataPattern = /window\.__NEXT_DATA__\s*=\s*(\{.*?\});/s;
    const nextDataMatch = html.match(jsonDataPattern);

    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        // Navigate through the structure to find matches
        const props = nextData.props?.pageProps || {};
        matches.push(...extractMatchesFromProps(props));
      } catch (e) {
        console.log('Failed to parse __NEXT_DATA__');
      }
    }

    // If no matches from JSON, try regex extraction
    if (matches.length === 0) {
      // Look for match cards in the HTML
      const matchCardPattern = /data-matchid=["'](\d+)["'][^>]*>.*?>([^<]+)\s+(\d+)\s*-\s*(\d+)\s+([^<]+)</gs;
      let matchMatch;
      while ((matchMatch = matchCardPattern.exec(html)) !== null) {
        matches.push({
          id: matchMatch[1],
          homeTeam: matchMatch[2].trim(),
          awayTeam: matchMatch[5].trim(),
          homeScore: matchMatch[3],
          awayScore: matchMatch[4],
          status: 'FT'
        });
      }
    }

    // Fallback: return sample upcoming fixtures if scraping fails
    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        data: getSampleFixtures(),
        note: 'Using sample data - live scraping not available'
      });
    }

    return NextResponse.json({
      success: true,
      data: matches
    });

  } catch (error) {
    console.error('FotMob fixtures error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch fixtures',
      data: getSampleFixtures()
    });
  }
}

function extractMatchesFromProps(props: any): any[] {
  const matches: any[] = [];

  function search(obj: any) {
    if (!obj || typeof obj !== 'object') return;

    // Check if this looks like match data
    if (obj.matchId && obj.homeTeam && obj.awayTeam) {
      matches.push({
        id: obj.matchId,
        homeTeam: obj.homeTeam,
        awayTeam: obj.awayTeam,
        homeScore: obj.homeScore || null,
        awayScore: obj.awayScore || null,
        status: obj.status || null,
        kickoffTime: obj.kickoffTime || obj.date || null,
        leagueId: obj.leagueId
      });
    }

    // Recursively search
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        obj[key].forEach(search);
      } else if (typeof obj[key] === 'object') {
        search(obj[key]);
      }
    }
  }

  search(props);
  return matches;
}

function getSampleFixtures() {
  return [
    { id: 'test1', homeTeam: 'Arsenal', awayTeam: 'Fulham', homeScore: 3, awayScore: 0, status: 'FT', kickoffTime: '2026-05-03' },
    { id: 'test2', homeTeam: 'Man United', awayTeam: 'Liverpool', homeScore: 0, awayScore: 0, status: 'LIVE', kickoffTime: '2026-05-03' },
    { id: 'test3', homeTeam: 'Bournemouth', awayTeam: 'Crystal Palace', homeScore: 2, awayScore: 0, status: 'LIVE', kickoffTime: '2026-05-03' },
    { id: 'test4', homeTeam: 'Aston Villa', awayTeam: 'Tottenham', homeScore: null, awayScore: null, status: 'NS', kickoffTime: '2026-05-04T02:00:00' },
    { id: 'test5', homeTeam: 'Chelsea', awayTeam: 'Nottm Forest', homeScore: null, awayScore: null, status: 'NS', kickoffTime: '2026-05-04T23:00:00' },
    { id: 'test6', homeTeam: 'Everton', awayTeam: 'Man City', homeScore: null, awayScore: null, status: 'NS', kickoffTime: '2026-05-04T23:00:00' },
  ];
}
