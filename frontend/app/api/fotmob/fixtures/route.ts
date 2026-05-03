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

    // Try to extract match data from page
    const matches = extractMatchesFromHTML(html);

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

function extractMatchesFromHTML(html: string): any[] {
  const matches: any[] = [];

  // Look for matchId patterns in the HTML
  const matchIdRegex = /"matchId"\s*:\s*(\d+)/g;
  const teamNameRegex = /"homeTeam"\s*:\s*"([^"]+)"|"awayTeam"\s*:\s*"([^"]+)"/g;
  const scoreRegex = /"score"\s*:\s*"(\d+)"/g;

  // Find all match IDs
  const matchIds: string[] = [];
  let matchIdMatch;
  while ((matchIdMatch = matchIdRegex.exec(html)) !== null) {
    matchIds.push(matchIdMatch[1]);
  }

  // Find team names
  const teamNames: string[] = [];
  let teamMatch;
  while ((teamMatch = teamNameRegex.exec(html)) !== null) {
    if (teamMatch[1]) teamNames.push(teamMatch[1]);
    if (teamMatch[2]) teamNames.push(teamMatch[2]);
  }

  // Find scores
  const scores: string[] = [];
  let scoreMatch;
  while ((scoreMatch = scoreRegex.exec(html)) !== null) {
    scores.push(scoreMatch[1]);
  }

  // Try to build match objects from found data
  // This is approximate since HTML structure varies
  if (teamNames.length >= 4) {
    for (let i = 0; i < Math.min(teamNames.length / 2, 10); i++) {
      const homeIdx = i * 2;
      const awayIdx = i * 2 + 1;
      if (homeIdx + 1 < teamNames.length) {
        matches.push({
          id: matchIds[i] || `match_${i}`,
          homeTeam: teamNames[homeIdx],
          awayTeam: teamNames[awayIdx] || teamNames[homeIdx + 1],
          homeScore: scores[i * 2] || null,
          awayScore: scores[i * 2 + 1] || null,
          status: scores[i * 2] ? 'FT' : 'NS'
        });
      }
    }
  }

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
