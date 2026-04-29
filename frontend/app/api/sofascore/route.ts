import { NextResponse } from 'next/server'

const BASE_URL = 'https://www.sofascore.com/api/v1'

// Tournament and season IDs
const TOURNAMENTS: Record<string, { id: number; seasonId: number; name: string }> = {
  brazil: { id: 325, seasonId: 87678, name: 'Brasileirão Betano' },
  argentina: { id: 155, seasonId: 87913, name: 'Primera LPF' },
}

// Fetch with retry
async function fetchWithRetry(url: string, retries = 2): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 } // 5 min cache
      })
      if (res.ok) return await res.json()
      if (i === retries - 1) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      if (i === retries - 1) throw e
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const league = searchParams.get('league') || 'brazil'
  const type = searchParams.get('type') || 'all' // standings, fixtures, or all

  const tournament = TOURNAMENTS[league]
  if (!tournament) {
    return NextResponse.json({ error: 'Unknown league' }, { status: 400 })
  }

  try {
    const t = tournament

    // Fetch standings and current round in parallel
    const [standingsData, roundsData] = await Promise.all([
      fetchWithRetry(`${BASE_URL}/unique-tournament/${t.id}/season/${t.seasonId}/standings/total`),
      fetchWithRetry(`${BASE_URL}/unique-tournament/${t.id}/season/${t.seasonId}/rounds`)
    ])

    // Parse standings
    const standingsList = standingsData?.standings || []
    let rows: any[] = []
    for (const group of standingsList) {
      if (group.type === 'total') {
        rows = group.rows || []
        if (rows.length >= 15) break
      }
    }

    const standings = rows.map((row: any) => ({
      rank: row.position,
      team: row.team?.name || 'Unknown',
      shortName: row.team?.shortName || '',
      played: row.matches,
      won: row.wins,
      drawn: row.draws,
      lost: row.losses,
      goalsFor: row.scoresFor,
      goalsAgainst: row.scoresAgainst,
      goalDiff: row.scoresFor - row.scoresAgainst,
      points: row.points,
    }))

    // Get current round
    const currentRound = roundsData?.currentRound?.round || 1
    const allRounds = roundsData?.rounds || []

    // Find next round with upcoming fixtures
    let nextRoundNum = currentRound
    let fixtures: any[] = []

    for (const r of allRounds) {
      const roundNum = r.round
      if (roundNum < currentRound) continue

      try {
        const fixturesRes = await fetchWithRetry(
          `${BASE_URL}/unique-tournament/${t.id}/season/${t.seasonId}/events/round/${roundNum}`
        )
        const events = fixturesRes?.events || []
        const hasUpcoming = events.some((e: any) => e.status?.code === 0)

        if (hasUpcoming) {
          fixtures = events.map((e: any) => ({
            id: e.id,
            home: e.homeTeam?.name || 'Unknown',
            away: e.awayTeam?.name || 'Unknown',
            homeShort: e.homeTeam?.shortName || '',
            awayShort: e.awayTeam?.shortName || '',
            status: e.status?.description || 'Unknown',
            statusCode: e.status?.code || -1,
            date: e.startTimestamp ? new Date(e.startTimestamp * 1000).toISOString().split('T')[0] : 'TBD',
            time: e.startTimestamp ? new Date(e.startTimestamp * 1000).toTimeString().slice(0, 5) : '00:00',
            homeScore: e.homeScore?.current ?? null,
            awayScore: e.awayScore?.current ?? null,
            round: roundNum,
          }))
          nextRoundNum = roundNum
          break
        }
      } catch {
        continue
      }
    }

    return NextResponse.json({
      league,
      name: t.name,
      currentRound: nextRoundNum,
      standings,
      fixtures,
      updated: new Date().toISOString()
    })

  } catch (error: any) {
    console.error(`Sofascore API error for ${league}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
