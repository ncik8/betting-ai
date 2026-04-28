import { NextResponse } from 'next/server';

// Simple in-memory prediction engine (no pickle loading in serverless)
// This provides predictions based on current table data + historical patterns

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
};

function formToNumeric(form: string): number {
  const scores: Record<string, number> = { "W": 3, "D": 1, "L": 0 };
  const chars = form.replace(/\s/g, '').toUpperCase().split('');
  const total = chars.reduce((sum, c) => sum + (scores[c] ?? 0), 0);
  return chars.length > 0 ? total / chars.length : 1.5;
}

function getTableFeatures(home: string, away: string) {
  const homeData = LIVE_TABLE[home] ?? { pos: 10, pts: 40, gd: 0, form: "DDDDD" };
  const awayData = LIVE_TABLE[away] ?? { pos: 10, pts: 40, gd: 0, form: "DDDDD" };
  
  return {
    homePos: homeData.pos,
    awayPos: awayData.pos,
    homePts: homeData.pts,
    awayPts: awayData.pts,
    homeGd: homeData.gd,
    awayGd: awayData.gd,
    homeForm: formToNumeric(homeData.form),
    awayForm: formToNumeric(awayData.form),
    posDiff: homeData.pos - awayData.pos,
    formDiff: formToNumeric(homeData.form) - formToNumeric(awayData.form),
  };
}

function predict1X2(home: string, away: string) {
  const f = getTableFeatures(home, away);
  const homeAdvantage = 0.12;
  const homeScore = f.homeForm + homeAdvantage;
  const awayScore = f.awayForm;
  const total = homeScore + awayScore + 1.2;
  
  return {
    H: Math.round((homeScore / total) * 1000) / 1000,
    D: Math.round((1.2 / total) * 1000) / 1000,
    A: Math.round((awayScore / total) * 1000) / 1000,
  };
}

function predictOverUnder(home: string, away: string) {
  const f = getTableFeatures(home, away);
  const homeGoals = 1.3 + (f.homeForm - 1.5) * 0.3;
  const awayGoals = 1.0 + (f.awayForm - 1.5) * 0.3;
  const totalExpected = Math.max(0.5, homeGoals + awayGoals);
  
  const overProb = Math.min(0.85, Math.max(0.25, (totalExpected - 1.5) / 3 + 0.45));
  
  return {
    over_2_5: Math.round(overProb * 1000) / 1000,
    under_2_5: Math.round((1 - overProb) * 1000) / 1000,
    expected_goals: Math.round(totalExpected * 10) / 10,
  };
}

function predictBTTS(home: string, away: string) {
  const f = getTableFeatures(home, away);
  const homeAttack = 1.3 + (f.homeForm - 1.5) * 0.2;
  const awayAttack = 1.0 + (f.awayForm - 1.5) * 0.2;
  
  const bttsProb = Math.min(0.75, Math.max(0.30, (homeAttack + awayAttack) / 3 + 0.25));
  
  return {
    yes: Math.round(bttsProb * 1000) / 1000,
    no: Math.round((1 - bttsProb) * 1000) / 1000,
  };
}

function predictCorners(home: string, away: string) {
  const f = getTableFeatures(home, away);
  const homeCorners = 5.5 + (f.homeForm - 1.5) * 0.5;
  const awayCorners = 4.5 + (f.awayForm - 1.5) * 0.4;
  const total = Math.max(4, Math.min(14, homeCorners + awayCorners));
  
  const overProb = Math.min(0.70, Math.max(0.30, (total - 8) / 8 + 0.35));
  
  return {
    total: Math.round(total * 10) / 10,
    over_10_5: Math.round(overProb * 1000) / 1000,
    under_10_5: Math.round((1 - overProb) * 1000) / 1000,
    home_corners: Math.round(homeCorners * 10) / 10,
    away_corners: Math.round(awayCorners * 10) / 10,
  };
}

function predictHTFT(home: string, away: string) {
  const f = getTableFeatures(home, away);
  
  if (f.homeForm > 2.0) {
    return { HH: 0.25, HD: 0.10, HA: 0.05, DH: 0.08, DD: 0.12, DA: 0.08, AH: 0.05, AD: 0.10, AA: 0.17 };
  } else if (f.awayForm > 2.0) {
    return { HH: 0.15, HD: 0.10, HA: 0.10, DH: 0.05, DD: 0.12, DA: 0.13, AH: 0.05, AD: 0.12, AA: 0.18 };
  } else {
    return { HH: 0.18, HD: 0.10, HA: 0.08, DH: 0.08, DD: 0.18, DA: 0.08, AH: 0.05, AD: 0.10, AA: 0.15 };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get('home');
  const away = searchParams.get('away');

  if (!home || !away) {
    return NextResponse.json({ error: 'Missing home or away team' }, { status: 400 });
  }

  const prediction = {
    home,
    away,
    one_x_two: predict1X2(home, away),
    over_under: predictOverUnder(home, away),
    btts: predictBTTS(home, away),
    corners: predictCorners(home, away),
    ht_ft: predictHTFT(home, away),
    table_context: getTableFeatures(home, away),
  };

  return NextResponse.json(prediction);
}
