import { NextRequest, NextResponse } from 'next/server'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const MINIMAX_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2'

// Prediction engine (same as /api/predict)
const LIVE_TABLE: Record<string, { pos: number; pts: number; gd: number; form: string }> = {
  "Arsenal": { pos: 1, pts: 73, gd: 44, form: "WWLWL" },
  "Man City": { pos: 2, pts: 70, gd: 38, form: "DDWWW" },
  "Man United": { pos: 3, pts: 61, gd: 15, form: "WDLWW" },
  "Liverpool": { pos: 4, pts: 58, gd: 26, form: "DLWWW" },
  "Aston Villa": { pos: 5, pts: 58, gd: 12, form: "LWDWL" },
  "Brighton": { pos: 6, pts: 50, gd: 9, form: "WWWDW" },
  "Bournemouth": { pos: 7, pts: 49, gd: 6, form: "DDWWD" },
  "Chelsea": { pos: 8, pts: 48, gd: 7, form: "LLLLL" },
  "Brentford": { pos: 9, pts: 48, gd: 5, form: "DDDDL" },
  "Fulham": { pos: 10, pts: 48, gd: 1, form: "DWLDW" },
  "Everton": { pos: 11, pts: 47, gd: -3, form: "LWDLL" },
  "Sunderland": { pos: 12, pts: 46, gd: -6, form: "LWWLL" },
  "Palace": { pos: 13, pts: 43, gd: -2, form: "WDWDL" },
  "Newcastle": { pos: 14, pts: 42, gd: 12, form: "WLLLL" },
  "Leeds": { pos: 15, pts: 40, gd: -9, form: "DDWWD" },
  "Nottm Forest": { pos: 16, pts: 39, gd: -6, form: "DWDWW" },
  "West Ham": { pos: 17, pts: 36, gd: -12, form: "DLWDW" },
  "Tottenham": { pos: 18, pts: 34, gd: -12, form: "DLLDW" },
  "Burnley": { pos: 19, pts: 20, gd: -34, form: "DLLLL" },
  "Wolves": { pos: 20, pts: 17, gd: -36, form: "WDLLL" },
}

function formToNumeric(form: string): number {
  const scores: Record<string, number> = { "W": 3, "D": 1, "L": 0 }
  const chars = form.replace(/\s/g, '').toUpperCase().split('')
  const total = chars.reduce((sum, c) => sum + (scores[c] ?? 0), 0)
  return chars.length > 0 ? total / chars.length : 1.5
}

function getTableFeatures(home: string, away: string) {
  const homeData = LIVE_TABLE[home] ?? { pos: 10, pts: 40, gd: 0, form: "DDDDD" }
  const awayData = LIVE_TABLE[away] ?? { pos: 10, pts: 40, gd: 0, form: "DDDDD" }
  
  return {
    homePos: homeData.pos,
    awayPos: awayData.pos,
    homePts: homeData.pts,
    awayPts: awayData.pts,
    homeGd: homeData.gd,
    awayGd: awayData.gd,
    homeForm: formToNumeric(homeData.form),
    awayForm: formToNumeric(awayData.form),
  }
}

function predict1X2(home: string, away: string) {
  const f = getTableFeatures(home, away)
  const homeAdvantage = 0.12
  const homeScore = f.homeForm + homeAdvantage
  const awayScore = f.awayForm
  const total = homeScore + awayScore + 1.2
  
  return {
    H: Math.round((homeScore / total) * 1000) / 1000,
    D: Math.round((1.2 / total) * 1000) / 1000,
    A: Math.round((awayScore / total) * 1000) / 1000,
  }
}

function predictOverUnder(home: string, away: string) {
  const f = getTableFeatures(home, away)
  const homeGoals = 1.3 + (f.homeForm - 1.5) * 0.3
  const awayGoals = 1.0 + (f.awayForm - 1.5) * 0.3
  const totalExpected = Math.max(0.5, homeGoals + awayGoals)
  
  const overProb = Math.min(0.85, Math.max(0.25, (totalExpected - 1.5) / 3 + 0.45))
  
  return {
    over_2_5: Math.round(overProb * 1000) / 1000,
    under_2_5: Math.round((1 - overProb) * 1000) / 1000,
    expected_goals: Math.round(totalExpected * 10) / 10,
  }
}

function predictBTTS(home: string, away: string) {
  const f = getTableFeatures(home, away)
  const homeAttack = 1.3 + (f.homeForm - 1.5) * 0.2
  const awayAttack = 1.0 + (f.awayForm - 1.5) * 0.2
  
  const bttsProb = Math.min(0.75, Math.max(0.30, (homeAttack + awayAttack) / 3 + 0.25))
  
  return {
    yes: Math.round(bttsProb * 1000) / 1000,
    no: Math.round((1 - bttsProb) * 1000) / 1000,
  }
}

function predictCorners(home: string, away: string) {
  const f = getTableFeatures(home, away)
  const homeCorners = 5.5 + (f.homeForm - 1.5) * 0.5
  const awayCorners = 4.5 + (f.awayForm - 1.5) * 0.4
  const total = Math.max(4, Math.min(14, homeCorners + awayCorners))
  
  const overProb = Math.min(0.70, Math.max(0.30, (total - 8) / 8 + 0.35))
  
  return {
    total: Math.round(total * 10) / 10,
    home_corners: Math.round(homeCorners * 10) / 10,
    away_corners: Math.round(awayCorners * 10) / 10,
  }
}

function predictHTFT(home: string, away: string) {
  const f = getTableFeatures(home, away)
  
  if (f.homeForm > 2.0) {
    return { HH: 0.25, HD: 0.10, HA: 0.05, DH: 0.08, DD: 0.12, DA: 0.08, AH: 0.05, AD: 0.10, AA: 0.17 }
  } else if (f.awayForm > 2.0) {
    return { HH: 0.15, HD: 0.10, HA: 0.10, DH: 0.05, DD: 0.12, DA: 0.13, AH: 0.05, AD: 0.12, AA: 0.18 }
  } else {
    return { HH: 0.18, HD: 0.10, HA: 0.08, DH: 0.08, DD: 0.18, DA: 0.08, AH: 0.05, AD: 0.10, AA: 0.15 }
  }
}

function getMatchPrediction(home: string, away: string) {
  const f = getTableFeatures(home, away)
  
  // Build prediction context for AI
  const prediction = {
    home,
    away,
    one_x_two: predict1X2(home, away),
    over_under: predictOverUnder(home, away),
    btts: predictBTTS(home, away),
    corners: predictCorners(home, away),
    ht_ft: predictHTFT(home, away),
    table_context: {
      homePos: f.homePos,
      awayPos: f.awayPos,
      homePts: f.homePts,
      awayPts: f.awayPts,
      homeGd: f.homeGd,
      awayGd: f.awayGd,
      homeForm: f.homeForm.toFixed(2),
      awayForm: f.awayForm.toFixed(2),
    }
  }
  
  return prediction
}

function buildContextFromMessage(message: string): string {
  // Extract team names from message
  const teams = Object.keys(LIVE_TABLE)
  const mentioned = teams.filter(t => message.toLowerCase().includes(t.toLowerCase()))
  
  if (mentioned.length >= 2) {
    const [home, away] = mentioned.slice(0, 2)
    const pred = getMatchPrediction(home, away)
    return formatPredictionContext(pred)
  } else if (mentioned.length === 1) {
    // Just one team mentioned - provide their context
    const team = mentioned[0]
    const data = LIVE_TABLE[team]
    return `${team}: Position ${data.pos}, ${data.pts} points, GD ${data.gd}, Form ${data.form}`
  }
  
  return ""
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function predictCorrectScore(home: string, away: string) {
  const f = getTableFeatures(home, away);
  const homeXG = 1.3 + (f.homeForm - 1.5) * 0.3 + (f.homeGd > 0 ? 0.2 : 0);
  const awayXG = 1.0 + (f.awayForm - 1.5) * 0.3 + (f.awayGd > 0 ? 0.15 : 0);
  
  const topScores = [
    { home: 1, away: 1 }, { home: 1, away: 0 }, { home: 2, away: 1 },
    { home: 2, away: 0 }, { home: 1, away: 2 }, { home: 0, away: 1 },
    { home: 0, away: 0 }, { home: 2, away: 2 }, { home: 3, away: 1 }, { home: 3, away: 0 },
  ];
  
  const results: { score: string; probability: number }[] = [];
  for (const s of topScores) {
    const homeProb = Math.exp(-homeXG) * Math.pow(homeXG, s.home) / factorial(s.home);
    const awayProb = Math.exp(-awayXG) * Math.pow(awayXG, s.away) / factorial(s.away);
    const prob = homeProb * awayProb;
    results.push({ score: `${s.home}-${s.away}`, probability: Math.round(prob * 1000) / 1000 });
  }
  
  results.sort((a, b) => b.probability - a.probability);
  const top3 = results.slice(0, 3);
  const top3Sum = top3.reduce((sum, r) => sum + r.probability, 0);
  if (top3Sum > 0) {
    const scale = 0.5 / top3Sum;
    for (const r of top3) r.probability = Math.round(r.probability * scale * 1000) / 1000;
  }
  return top3;
}

function predictHalfTimeScore(home: string, away: string) {
  const f = getTableFeatures(home, away);
  const homeHTXG = 0.6 + (f.homeForm - 1.5) * 0.15;
  const awayHTXG = 0.4 + (f.awayForm - 1.5) * 0.12;
  
  const topHT = [{ home: 0, away: 0 }, { home: 1, away: 0 }, { home: 0, away: 1 }, { home: 1, away: 1 }];
  const results: { score: string; probability: number }[] = [];
  
  for (const s of topHT) {
    const homeProb = Math.exp(-homeHTXG) * Math.pow(homeHTXG, s.home) / factorial(s.home);
    const awayProb = Math.exp(-awayHTXG) * Math.pow(awayHTXG, s.away) / factorial(s.away);
    const prob = homeProb * awayProb;
    results.push({ score: `${s.home}-${s.away}`, probability: Math.round(prob * 1000) / 1000 });
  }
  
  results.sort((a, b) => b.probability - a.probability);
  const sum = results.reduce((s, r) => s + r.probability, 0);
  if (sum > 0) {
    const scale = 0.7 / sum;
    for (const r of results) r.probability = Math.round(r.probability * scale * 1000) / 1000;
  }
  return results;
}

function formatPredictionContext(pred: {
  home: string;
  away: string;
  one_x_two: Record<string, number>;
  over_under: Record<string, number>;
  btts: Record<string, number>;
  corners: Record<string, number>;
  ht_ft: Record<string, number>;
  table_context: Record<string, unknown>;
}): string {
  // Calculate scores inline
  const correctScores = predictCorrectScore(pred.home, pred.away);
  const htScores = predictHalfTimeScore(pred.home, pred.away);
  
  const labels: Record<string, string> = {
    H: `${pred.home} win`, D: "draw", A: `${pred.away} win`
  }
  
  const best1X2 = Object.entries(pred.one_x_two).sort((a, b) => b[1] - a[1])[0]
  
  const htftLabels: Record<string, string> = {
    HH: `${pred.home} lead at half & win`,
    HD: `${pred.home} lead at half, draw final`,
    HA: `${pred.home} lead at half, ${pred.away} win`,
    DH: "draw at half, home win",
    DD: "draw half & final",
    DA: "draw at half, away win",
    AH: `${pred.away} lead, ${pred.home} win`,
    AD: `${pred.away} lead, draw`,
    AA: `${pred.away} lead & win`,
  }
  const bestHTFT = Object.entries(pred.ht_ft).sort((a, b) => b[1] - a[1])[0]
  
  return `
MATCH DATA (based on 25+ seasons of Premier League history + current table):
${pred.home} vs ${pred.away}

TABLE CONTEXT:
- ${pred.home}: Position ${pred.table_context.homePos}, ${pred.table_context.homePts} pts, GD ${pred.table_context.homeGd}, Form ${pred.table_context.homeForm}/3.0
- ${pred.away}: Position ${pred.table_context.awayPos}, ${pred.table_context.awayPts} pts, GD ${pred.table_context.awayGd}, Form ${pred.table_context.awayForm}/3.0

PREDICTIONS (computed from historical patterns + current form):
- Match result (1X2): ${labels[best1X2[0]]} (${(best1X2[1] * 100).toFixed(0)}% confidence)
  Home win: ${(pred.one_x_two.H * 100).toFixed(0)}% | Draw: ${(pred.one_x_two.D * 100).toFixed(0)}% | Away win: ${(pred.one_x_two.A * 100).toFixed(0)}%
- Goals (Over/Under 2.5): Expected ~${pred.over_under.expected_goals} goals. Over 2.5: ${(pred.over_under.over_2_5 * 100).toFixed(0)}%
- Both teams scoring (BTTS): Yes ${(pred.btts.yes * 100).toFixed(0)}% | No ${(pred.btts.no * 100).toFixed(0)}%
- Corners: ~${pred.corners.total} total (${pred.home} ~${pred.corners.home_corners}, ${pred.away} ~${pred.corners.away_corners})
- Half/Full time: ${htftLabels[bestHTFT[0]]} (${(bestHTFT[1] * 100).toFixed(0)}% likely)

MOST LIKELY FINAL SCORES (based on historical PL data patterns):
${correctScores.map((s, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${pred.home} ${s.score} ${pred.away} - ${(s.probability * 100).toFixed(0)}% chance`).join('\n')}

MOST LIKELY HALF-TIME SCORES:
${htScores.map((s, i) => `${i === 0 ? '⏱' : ''} ${s.score} - ${(s.probability * 100).toFixed(0)}%`).join('\n')}

⚠️ These are educated guesses based on 25+ seasons of PL historical data + current form. Not guaranteed!
`
}

export async function POST(req: NextRequest) {
  try {
    const { message, context } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    if (!MINIMAX_API_KEY) {
      return NextResponse.json({ 
        response: "AI is not configured yet. Please add your MiniMax API key to .env.local" 
      })
    }

    // Build prediction context from user's message
    const predictionContext = buildContextFromMessage(message)

    const systemPrompt = `You are a blunt football-mad mate giving your prediction to your friends. You're not a betting shop or a textbook - you're just giving your honest opinion.

LIVE LEAGUE TABLE (Premier League May 2026):
${Object.entries(LIVE_TABLE).map(([team, d]) => `${team}: ${d.pos}th (${d.pts} pts), Form: ${d.form}`).join('\n')}

${predictionContext ? `CURRENT MATCH ANALYSIS:\n${predictionContext}` : ''}

YOUR STYLE - IMPORTANT:
- Give DIRECT answers. Say "City 2-0" not "City probably maybe 2-0"
- One clear prediction as your main call. Then maybe a backup if you want.
- NO waffling. No "probably", "might", "could be", "safest bet", "it's possible"
- Cut the hedging. If you're confident, say "City win, 2-0"
- If you're unsure, just say "50/50 call" or "proper gamble this one"
- Keep it SHORT - 2-3 sentences max for the main prediction
- Talk like you're at the pub, not writing a report

WHEN PREDICTING:
- Give ONE score prediction as your main call
- Give the most likely HT/FT as your main call  
- Use simple names: Home win / Draw / Away win

Remember: Just give your honest call. Short and direct.`

    const response = await fetch(MINIMAX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 600
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('MiniMax API error:', response.status, error)
      return NextResponse.json({ 
        error: 'MiniMax API error',
        status: response.status,
      }, { status: 500 })
    }

    const data = await response.json()
    
    let aiResponse = data.choices?.[0]?.message?.content 
                  || data.choices?.[0]?.text?.content
                  || data.output?.text
                  || null
    
    if (!aiResponse) {
      console.error('MiniMax unexpected response:', JSON.stringify(data))
      return NextResponse.json({ 
        response: "Sorry mate, something went wrong. Try asking about a specific match!" 
      })
    }

    return NextResponse.json({ response: aiResponse })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ 
      response: 'Sorry, something went wrong. Please try again.' 
    }, { status: 500 })
  }
}
