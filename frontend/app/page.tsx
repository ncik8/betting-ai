'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// Password protection
const CORRECT_PASSWORD='football2024'

// API Base URL
const API_BASE = '/api/football'

// League IDs for API
const LEAGUE_KEYS = {
  pl: 'premier_league',
  brazil: 'brazil', 
  argentina: 'argentina'
}

// Brazil Serie A data (trained on 5,446 matches)
const BRAZIL_MODEL = {
  totalMatches: 5446,
  seasons: 15,
  avgGoals: 2.56,
  homeWinRate: 47,
  drawRate: 26,
  awayWinRate: 27,
  over25Rate: 62,
  bttsRate: 46,
  topTeams: ['Flamengo', 'Palmeiras', 'Santos', 'São Paulo', 'Corinthians', 'Internacional', 'Athletico-PR', 'Grêmio'],
  prediction: { homeWin: 47, draw: 26, awayWin: 27, over25: 62, btts: 46 }
}

// Argentina Liga Profesional data (trained on 6,205 matches)
const ARGENTINA_MODEL = {
  totalMatches: 6205,
  seasons: 16,
  avgGoals: 2.38,
  homeWinRate: 44,
  drawRate: 29,
  awayWinRate: 27,
  over25Rate: 58,
  bttsRate: 43,
  topTeams: ['River Plate', 'Boca Juniors', 'Racing Club', 'Independiente', 'San Lorenzo', 'Huracán', 'Velez Sarsfield', 'Estudiantes'],
  prediction: { homeWin: 44, draw: 29, awayWin: 27, over25: 58, btts: 43 }
}

// Fallback PL data (used if API fails)
const FALLBACK_PL_TABLE = [
  { pos: 1,  team: 'Liverpool',    pts: 84, gd: 45, played: 34, form: 'WWWWW' },
  { pos: 2,  team: 'Arsenal',     pts: 74, gd: 38, played: 34, form: 'WWLWL' },
  { pos: 3,  team: 'Man City',    pts: 71, gd: 37, played: 34, form: 'DDWWW' },
  { pos: 4,  team: 'Chelsea',     pts: 69, gd: 22, played: 34, form: 'WDWLW' },
  { pos: 5,  team: 'Newcastle',   pts: 66, gd: 18, played: 34, form: 'DLWWW' },
  { pos: 6,  team: 'Aston Villa', pts: 58, gd:  5, played: 34, form: 'LWDWL' },
  { pos: 7,  team: 'Brighton',    pts: 50, gd:  9, played: 34, form: 'WWWDW' },
  { pos: 8,  team: 'Bournemouth', pts: 49, gd:  0, played: 34, form: 'DDWWD' },
  { pos: 9,  team: 'Brentford',  pts: 48, gd:  3, played: 34, form: 'DDDDL' },
  { pos: 10, team: 'Fulham',     pts: 48, gd: -2, played: 34, form: 'DWLDW' },
  { pos: 11, team: 'Everton',    pts: 47, gd:  0, played: 34, form: 'LWDLL' },
  { pos: 12, team: 'Crystal Palace', pts: 46, gd: -6, played: 34, form: 'LWWLL' },
  { pos: 13, team: 'Sunderland', pts: 43, gd: -9, played: 34, form: 'WDWDL' },
  { pos: 14, team: 'Man United', pts: 42, gd: -4, played: 34, form: 'WLLWW' },
  { pos: 15, team: 'West Ham',   pts: 40, gd: -7, played: 34, form: 'DDWWD' },
  { pos: 16, team: 'Tottenham',  pts: 39, gd: -4, played: 34, form: 'DWDWW' },
  { pos: 17, team: 'Leeds',      pts: 36, gd:-16, played: 34, form: 'DLWDL' },
  { pos: 18, team: 'Nottm Forest', pts: 34, gd:-10, played: 34, form: 'DLLDW' },
  { pos: 19, team: 'Burnley',    pts: 20, gd:-34, played: 34, form: 'DLLLL' },
  { pos: 20, team: 'Wolves',     pts: 17, gd:-38, played: 34, form: 'WDLLL' },
]

const FALLBACK_PL_FIXTURES = [
  { home: 'Arsenal',        away: 'Fulham',         date: '03 May', time: '00:30', homeWin: 67, draw: 25, awayWin: 8,  over25: 65, btts: 52, corners: 12 },
  { home: 'Man United',     away: 'Liverpool',       date: '03 May', time: '22:30', homeWin: 13, draw: 38, awayWin: 49, over25: 63, btts: 50, corners: 12 },
  { home: 'Bournemouth',    away: 'Crystal Palace',  date: '03 May', time: '21:00', homeWin: 28, draw: 40, awayWin: 32, over25: 61, btts: 50, corners: 11 },
  { home: 'Aston Villa',   away: 'Tottenham',       date: '04 May', time: '02:00', homeWin: 36, draw: 40, awayWin: 24, over25: 62, btts: 52, corners: 13 },
  { home: 'Chelsea',        away: 'Nottm Forest',   date: '04 May', time: '23:00', homeWin: 34, draw: 40, awayWin: 26, over25: 63, btts: 55, corners: 13 },
  { home: 'Everton',        away: 'Man City',       date: '04 May', time: '23:00', homeWin: 8,  draw: 31, awayWin: 61, over25: 67, btts: 53, corners: 12 },
  { home: 'Sunderland',     away: 'Brighton',        date: '04 May', time: '21:00', homeWin: 29, draw: 40, awayWin: 31, over25: 62, btts: 51, corners: 11 },
  { home: 'Burnley',        away: 'Leeds',           date: '05 May', time: '00:30', homeWin: 21, draw: 40, awayWin: 39, over25: 58, btts: 48, corners: 10 },
  { home: 'Wolves',         away: 'Brentford',       date: '05 May', time: '02:00', homeWin: 21, draw: 40, awayWin: 39, over25: 61, btts: 49, corners: 11 },
  { home: 'Newcastle',      away: 'West Ham',        date: '05 May', time: '21:00', homeWin: 29, draw: 40, awayWin: 31, over25: 62, btts: 51, corners: 11 },
]

// Brazil Serie A data (trained on 5,446 matches)
const BRAZIL_MODEL = {
  totalMatches: 5446,
  seasons: 15,
  avgGoals: 2.56,
  homeWinRate: 47,
  drawRate: 26,
  awayWinRate: 27,
  over25Rate: 62,
  bttsRate: 46,
  topTeams: ['Flamengo', 'Palmeiras', 'Santos', 'São Paulo', 'Corinthians', 'Internacional', 'Athletico-PR', 'Grêmio'],
  prediction: { homeWin: 47, draw: 26, awayWin: 27, over25: 62, btts: 46 }
}

// Argentina Liga Profesional data (trained on 6,205 matches)
const ARGENTINA_MODEL = {
  totalMatches: 6205,
  seasons: 16,
  avgGoals: 2.38,
  homeWinRate: 44,
  drawRate: 29,
  awayWinRate: 27,
  over25Rate: 58,
  bttsRate: 43,
  topTeams: ['River Plate', 'Boca Juniors', 'Racing Club', 'Independiente', 'San Lorenzo', 'Huracán', 'Velez Sarsfield', 'Estudiantes'],
  prediction: { homeWin: 44, draw: 29, awayWin: 27, over25: 58, btts: 43 }
}

// Fallback PL data (used if API fails)
const CHAT_INTROS = {
  pl: '👋 Hi! I\'m your Premier League betting assistant. Ask me anything about this weekend\'s matches!',
  brazil: '👋 Olá! I\'m your Brazil Serie A betting assistant. Ask me about Flamengo, Palmeiras, or any Brazilian matches!',
  argentina: '👋 Hola! I\'m your Argentina Liga Profesional betting assistant. Ask me about River Plate, Boca Juniors, or any Argentine matches!',
  racing: '👋 Hi! I\'m your HK Horse Racing assistant. Racing happens Wed (Happy Valley) & Sat/Sun (Sha Tin).'
}

// AI Chat
interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState<'pl' | 'brazil' | 'argentina' | 'racing'>('pl')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: CHAT_INTROS.pl }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Live data state
  const [plTable, setPlTable] = useState(FALLBACK_PL_TABLE)
  const [plFixtures, setPlFixtures] = useState(FALLBACK_PL_FIXTURES)
  const [brazilTable, setBrazilTable] = useState<any[]>([])
  const [brazilFixtures, setBrazilFixtures] = useState<any[]>([])
  const [argentinaTable, setArgentinaTable] = useState<any[]>([])
  const [argentinaFixtures, setArgentinaFixtures] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  // Fetch live data on mount
  useEffect(() => {
    async function fetchData() {
      setDataLoading(true)
      try {
        // Fetch PL standings
        const plRes = await fetch(`${API_BASE}?league=premier_league&type=standings`)
        const plData = await plRes.json()
        if (plData.teams?.length > 0) {
          setPlTable(plData.teams.map((t: any) => ({
            pos: t.rank,
            team: t.name,
            pts: t.points,
            gd: t.goalDifference,
            played: t.played,
            form: t.form || ''
          })))
        }
        
        // Fetch PL fixtures
        const fixturesRes = await fetch(`${API_BASE}?league=premier_league&type=fixtures`)
        const fixturesData = await fixturesRes.json()
        if (fixturesData.length > 0) {
          setPlFixtures(fixturesData.slice(0, 10).map((f: any) => ({
            home: f.homeTeam?.name || f.home,
            away: f.awayTeam?.name || f.away,
            date: f.date?.split(' ')[0] || f.date,
            time: f.time || '00:00',
            homeWin: 45,
            draw: 30,
            awayWin: 25,
            over25: 55,
            btts: 50,
            corners: 11
          })))
        }
        
        // Fetch Brazil standings
        const brazilRes = await fetch(`${API_BASE}?league=brazil&type=standings`)
        const brazilData = await brazilRes.json()
        if (brazilData.teams?.length > 0) {
          setBrazilTable(brazilData.teams.map((t: any) => ({
            pos: t.rank,
            team: t.name,
            pts: t.points,
            gd: t.goalDifference,
            played: t.played,
            form: t.form || ''
          })))
        }
        
        // Fetch Brazil fixtures
        const brazilFixturesRes = await fetch(`${API_BASE}?league=brazil&type=fixtures`)
        const brazilFixturesData = await brazilFixturesRes.json()
        if (brazilFixturesData.length > 0) {
          setBrazilFixtures(brazilFixturesData.slice(0, 10).map((f: any) => ({
            home: f.homeTeam?.name || f.home,
            away: f.awayTeam?.name || f.away,
            date: f.date?.split(' ')[0] || f.date,
            time: f.time || '00:00'
          })))
        }
        
        // Fetch Argentina standings
        const argRes = await fetch(`${API_BASE}?league=argentina&type=standings`)
        const argData = await argRes.json()
        if (argData.teams?.length > 0) {
          setArgentinaTable(argData.teams.map((t: any) => ({
            pos: t.rank,
            team: t.name,
            pts: t.points,
            gd: t.goalDifference,
            played: t.played,
            form: t.form || ''
          })))
        }
        
        // Fetch Argentina fixtures
        const argFixturesRes = await fetch(`${API_BASE}?league=argentina&type=fixtures`)
        const argFixturesData = await argFixturesRes.json()
        if (argFixturesData.length > 0) {
          setArgentinaFixtures(argFixturesData.slice(0, 10).map((f: any) => ({
            home: f.homeTeam?.name || f.home,
            away: f.awayTeam?.name || f.away,
            date: f.date?.split(' ')[0] || f.date,
            time: f.time || '00:00'
          })))
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setDataLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset chat when switching leagues
  useEffect(() => {
    setMessages([{ role: 'assistant', content: CHAT_INTROS[activeTab] }])
    setInput('')
  }, [activeTab])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true)
    } else {
      alert('Incorrect password')
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    // Build context based on active league
    let context = ''
    if (activeTab === 'pl') {
      context = `
Current Premier League Table:
${plTable.map((t: any) => `${t.pos}. ${t.team} - ${t.pts}pts`).join('\n')}

This Weekend's Matches:
${plFixtures.length > 0 ? plFixtures.map((f: any) => `${f.home} vs ${f.away} (${f.date} ${f.time}) - 1X2: ${f.homeWin || 45}%/${f.draw || 30}%/${f.awayWin || 25}%, Over 2.5: ${f.over25 || 55}%, BTTS: ${f.btts || 50}%, Corners: ${f.corners || 11}`).join('\n') : 'Fixtures loading...'}

ML Model trained on 10,225 PL matches. Answer questions about Premier League matches, teams, and betting odds.
`
    } else if (activeTab === 'brazil') {
      context = `
Brazil Serie A Table:
${brazilTable.length > 0 ? brazilTable.map((t: any) => `${t.pos}. ${t.team} - ${t.pts}pts`).join('\n') : 'Table loading...'}

Brazil Serie A Data (trained on ${BRAZIL_MODEL.totalMatches.toLocaleString()} matches):
- Average Goals: ${BRAZIL_MODEL.avgGoals} per match
- Home Win Rate: ${BRAZIL_MODEL.homeWinRate}%
- Draw Rate: ${BRAZIL_MODEL.drawRate}%
- Away Win Rate: ${BRAZIL_MODEL.awayWinRate}%
- Over 2.5 Rate: ${BRAZIL_MODEL.over25Rate}%
- BTTS Rate: ${BRAZIL_MODEL.bttsRate}%

Upcoming Matches:
${brazilFixtures.length > 0 ? brazilFixtures.map((f: any) => `${f.home} vs ${f.away} (${f.date} ${f.time})`).join('\n') : 'Fixtures loading...'}

Season: April - December (mostly Sat/Sun + midweek Tue-Thu)

ML Model trained on Brazilian football data. Answer questions about Brazil Serie A matches and betting.
`
    } else if (activeTab === 'argentina') {
      context = `
Argentina Liga Profesional Table:
${argentinaTable.length > 0 ? argentinaTable.map((t: any) => `${t.pos}. ${t.team} - ${t.pts}pts`).join('\n') : 'Table loading...'}

Argentina Liga Profesional Data (trained on ${ARGENTINA_MODEL.totalMatches.toLocaleString()} matches):
- Average Goals: ${ARGENTINA_MODEL.avgGoals} per match
- Home Win Rate: ${ARGENTINA_MODEL.homeWinRate}%
- Draw Rate: ${ARGENTINA_MODEL.drawRate}%
- Away Win Rate: ${ARGENTINA_MODEL.awayWinRate}%
- Over 2.5 Rate: ${ARGENTINA_MODEL.over25Rate}%
- BTTS Rate: ${ARGENTINA_MODEL.bttsRate}%

Upcoming Matches:
${argentinaFixtures.length > 0 ? argentinaFixtures.map((f: any) => `${f.home} vs ${f.away} (${f.date} ${f.time})`).join('\n') : 'Fixtures loading...'}

Season: February - December (mostly Sat/Sun + some Fri/Mon)

ML Model trained on Argentine football data. Answer questions about Argentina Liga Profesional matches and betting.
`
    } else if (activeTab === 'racing') {
      context = `
HK Horse Racing Information:
- Racing happens Wed (Happy Valley) and Sat/Sun (Sha Tin)
- Weather and grass conditions affect performance
- Happy Valley: Turf (Wednesday)
- Sha Tin: Turf (Saturday/Sunday)

Coming soon: Live race data, horse form, trainer stats, and AI predictions.
`
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          context: context
        })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I\'m having trouble connecting. Try again!' }])
    } finally {
      setIsLoading(false)
    }
  }

  // Password Screen
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-icon">⚽</div>
          <h1>Betting AI</h1>
          <p>Premier League Predictions</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="password-input"
            />
            <button type="submit" className="login-button">
              Enter
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Main Dashboard
  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>⚽ Betting AI</h1>
          <p className="subtitle">Premier League • Brazil • Argentina • HK Racing</p>
        </div>
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'pl' ? 'active' : ''}`}
            onClick={() => setActiveTab('pl')}
          >
            🏆 Premier League
          </button>
          <button 
            className={`tab ${activeTab === 'brazil' ? 'active' : ''}`}
            onClick={() => setActiveTab('brazil')}
          >
            🇧🇷 Brazil
          </button>
          <button 
            className={`tab ${activeTab === 'argentina' ? 'active' : ''}`}
            onClick={() => setActiveTab('argentina')}
          >
            🇦🇷 Argentina
          </button>
          <button 
            className={`tab ${activeTab === 'racing' ? 'active' : ''}`}
            onClick={() => setActiveTab('racing')}
          >
            🐴 HK Racing
          </button>
        </div>
      </header>

      {activeTab === 'pl' && (
        <div className="content-grid">
          {/* Left Column: Table + Fixtures */}
          <div className="left-column">
            
            {/* Live Table */}
            <div className="card">
              <h2 className="card-title">📊 Live Table {dataLoading && '(Loading...)'}</h2>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>GD</th>
                      <th>Pts</th>
                      <th>Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plTable.map((team: any) => (
                      <tr key={team.pos} className={team.pos <= 4 ? 'top-four' : team.pos >= 18 ? 'relegation' : ''}>
                        <td>{team.pos}</td>
                        <td className="team-name">{team.team}</td>
                        <td>{team.played}</td>
                        <td className={team.gd > 0 ? 'positive' : team.gd < 0 ? 'negative' : ''}>
                          {team.gd > 0 ? '+' : ''}{team.gd}
                        </td>
                        <td className="points">{team.pts}</td>
                        <td className="form">
                          {(team.form || '').split('').map((r: string, i: number) => (
                            <span key={i} className={`form-badge ${r.toLowerCase()}`}>{r}</span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weekend Fixtures */}
            <div className="card">
              <h2 className="card-title">📅 This Weekend's Matches</h2>
              <div className="fixtures">
                {plFixtures.length > 0 ? plFixtures.map((match: any, i: number) => {
                  const pick = match.homeWin > match.awayWin + 10 ? match.home : 
                              match.awayWin > match.homeWin + 10 ? match.away : 'Draw'
                  const confidence = Math.max(match.homeWin || 0, match.draw || 0, match.awayWin || 0)
                  
                  return (
                    <div key={i} className="fixture-row">
                      <div className="fixture-teams">
                        <span className="home-team">{match.home}</span>
                        <span className="vs">vs</span>
                        <span className="away-team">{match.away}</span>
                      </div>
                      <div className="fixture-meta">
                        <span className="fixture-time">{match.date} {match.time}</span>
                        <span className="confidence">{confidence.toFixed(0)}% conf</span>
                      </div>
                      <div className="prediction">
                        <span className="pick">Pick: {pick}</span>
                      </div>
                      <div className="odds-row">
                        <span className={`odd ${(match.homeWin || 0) > 40 ? 'high' : ''}`}>
                          1: {match.homeWin || 0}%
                        </span>
                        <span className="odd">
                          X: {match.draw || 0}%
                        </span>
                        <span className={`odd ${(match.awayWin || 0) > 40 ? 'high' : ''}`}>
                          2: {match.awayWin || 0}%
                        </span>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="empty-state">Loading fixtures...</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: AI Chat */}
          <div className="right-column">
            <div className="card chat-card">
              <h2 className="card-title">💬 Ask the AI</h2>
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-content">{msg.content}</div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-content typing">Thinking...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Who should I bet on this weekend?"
                  className="chat-input"
                  disabled={isLoading}
                />
                <button type="submit" className="send-button" disabled={isLoading}>
                  ➤
                </button>
              </form>
            </div>

            {/* Quick Picks */}
            <div className="card">
              <h2 className="card-title">🎯 Top Picks This Week</h2>
              <div className="picks-list">
                <div className="pick-item high-confidence">
                  <span className="pick-team">Arsenal vs Fulham</span>
                  <span className="pick-reason">1st vs 11th, WWWWL home form</span>
                  <span className="pick-odds">66% confidence</span>
                </div>
                <div className="pick-item high-confidence">
                  <span className="pick-team">Man City @ Everton</span>
                  <span className="pick-reason">2nd vs 17th, away form strong</span>
                  <span className="pick-odds">61% confidence</span>
                </div>
                <div className="pick-item">
                  <span className="pick-team">Burnley @ Leeds</span>
                  <span className="pick-reason">10th vs 18th, Burnley in form</span>
                  <span className="pick-odds">51% confidence</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'racing' && (
        <div className="racing-coming-soon">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🐴</div>
              <h2>HK Horse Racing</h2>
              <p>Coming Soon</p>
              <p className="subtext">Racing happens Wed (Happy Valley) & Sat/Sun (Sha Tin)</p>
              <p className="subtext">Will include: Weather, grass conditions, horse form</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'brazil' && (
        <div className="content-grid">
          <div className="left-column">
            {/* Brazil Table */}
            <div className="card">
              <h2 className="card-title">🇧🇷 Brazil Serie A Table {dataLoading && '(Loading...)'}</h2>
              <p className="card-subtitle">Season 2024 (Latest available on free API)</p>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>GD</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brazilTable.length > 0 ? brazilTable.map((team: any) => (
                      <tr key={team.pos}>
                        <td>{team.pos}</td>
                        <td className="team-name">{team.team}</td>
                        <td>{team.played}</td>
                        <td className={team.gd > 0 ? 'positive' : team.gd < 0 ? 'negative' : ''}>
                          {team.gd > 0 ? '+' : ''}{team.gd}
                        </td>
                        <td className="points">{team.pts}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} style={{textAlign:'center'}}>Loading table...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Brazil ML Stats */}
            <div className="card">
              <h2 className="card-title">🤖 ML Model Stats</h2>
              <span className="data-badge">{BRAZIL_MODEL.totalMatches.toLocaleString()} matches trained • {BRAZIL_MODEL.seasons} seasons</span>
              
              <div className="sa-stats">
                <div className="sa-stat">
                  <span className="sa-stat-value">{BRAZIL_MODEL.avgGoals}</span>
                  <span className="sa-stat-label">Avg Goals</span>
                </div>
                <div className="sa-stat">
                  <span className="sa-stat-value">{BRAZIL_MODEL.homeWinRate}%</span>
                  <span className="sa-stat-label">Home Win</span>
                </div>
                <div className="sa-stat">
                  <span className="sa-stat-value">{BRAZIL_MODEL.over25Rate}%</span>
                  <span className="sa-stat-label">Over 2.5</span>
                </div>
                <div className="sa-stat">
                  <span className="sa-stat-value">{BRAZIL_MODEL.bttsRate}%</span>
                  <span className="sa-stat-label">BTTS</span>
                </div>
              </div>

              <h3 className="sa-section-title">Top Teams</h3>
              <div className="sa-teams-grid">
                {BRAZIL_MODEL.topTeams.map((team, i) => (
                  <span key={i} className="sa-team-badge">{team}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="right-column">
            {/* Brazil Fixtures */}
            <div className="card">
              <h2 className="card-title">📅 This Week's Matches</h2>
              <p className="card-subtitle">Sat/Sun + Tue-Thu midweek</p>
              <div className="fixtures">
                {brazilFixtures.length > 0 ? brazilFixtures.map((match: any, i: number) => (
                  <div key={i} className="fixture-row">
                    <div className="fixture-teams">
                      <span className="home-team">{match.home}</span>
                      <span className="vs">vs</span>
                      <span className="away-team">{match.away}</span>
                    </div>
                    <div className="fixture-meta">
                      <span>{match.date} {match.time}</span>
                    </div>
                    <div className="prediction">
                      <span className="pick">1X2: {BRAZIL_MODEL.homeWinRate}% / {BRAZIL_MODEL.drawRate}% / {BRAZIL_MODEL.awayWinRate}%</span>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state">Loading fixtures...</div>
                )}
              </div>
            </div>

            {/* Brazil AI Chat */}
            <div className="card chat-card">
              <h2 className="card-title">💬 Brazil Serie A AI</h2>
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-content">{msg.content}</div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-content typing">Thinking...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about Brazil Serie A..."
                  className="chat-input"
                  disabled={isLoading}
                />
                <button type="submit" className="send-button" disabled={isLoading}>➤</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'argentina' && (
        <div className="content-grid">
          <div className="left-column">
            {/* Argentina Table */}
            <div className="card">
              <h2 className="card-title">🇦🇷 Argentina Liga Table {dataLoading && '(Loading...)'}</h2>
              <p className="card-subtitle">Season 2024 (Latest available on free API)</p>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>GD</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {argentinaTable.length > 0 ? argentinaTable.map((team: any) => (
                      <tr key={team.pos}>
                        <td>{team.pos}</td>
                        <td className="team-name">{team.team}</td>
                        <td>{team.played}</td>
                        <td className={team.gd > 0 ? 'positive' : team.gd < 0 ? 'negative' : ''}>
                          {team.gd > 0 ? '+' : ''}{team.gd}
                        </td>
                        <td className="points">{team.pts}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} style={{textAlign:'center'}}>Loading table...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Argentina ML Stats */}
            <div className="card">
              <h2 className="card-title">🤖 ML Model Stats</h2>
              <span className="data-badge">{ARGENTINA_MODEL.totalMatches.toLocaleString()} matches trained • {ARGENTINA_MODEL.seasons} seasons</span>
              
              <div className="sa-stats">
                <div className="sa-stat">
                  <span className="sa-stat-value">{ARGENTINA_MODEL.avgGoals}</span>
                  <span className="sa-stat-label">Avg Goals</span>
                </div>
                <div className="sa-stat">
                  <span className="sa-stat-value">{ARGENTINA_MODEL.homeWinRate}%</span>
                  <span className="sa-stat-label">Home Win</span>
                </div>
                <div className="sa-stat">
                  <span className="sa-stat-value">{ARGENTINA_MODEL.over25Rate}%</span>
                  <span className="sa-stat-label">Over 2.5</span>
                </div>
                <div className="sa-stat">
                  <span className="sa-stat-value">{ARGENTINA_MODEL.bttsRate}%</span>
                  <span className="sa-stat-label">BTTS</span>
                </div>
              </div>

              <h3 className="sa-section-title">Top Teams</h3>
              <div className="sa-teams-grid">
                {ARGENTINA_MODEL.topTeams.map((team, i) => (
                  <span key={i} className="sa-team-badge">{team}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="right-column">
            {/* Argentina Fixtures */}
            <div className="card">
              <h2 className="card-title">📅 This Week's Matches</h2>
              <p className="card-subtitle">Sat/Sun + Fri/Mon occasional</p>
              <div className="fixtures">
                {argentinaFixtures.length > 0 ? argentinaFixtures.map((match: any, i: number) => (
                  <div key={i} className="fixture-row">
                    <div className="fixture-teams">
                      <span className="home-team">{match.home}</span>
                      <span className="vs">vs</span>
                      <span className="away-team">{match.away}</span>
                    </div>
                    <div className="fixture-meta">
                      <span>{match.date} {match.time}</span>
                    </div>
                    <div className="prediction">
                      <span className="pick">1X2: {ARGENTINA_MODEL.homeWinRate}% / {ARGENTINA_MODEL.drawRate}% / {ARGENTINA_MODEL.awayWinRate}%</span>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state">Loading fixtures...</div>
                )}
              </div>
            </div>

            {/* Argentina AI Chat */}
            <div className="card chat-card">
              <h2 className="card-title">💬 Argentina Liga AI</h2>
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-content">{msg.content}</div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-content typing">Thinking...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about Argentina Liga..."
                  className="chat-input"
                  disabled={isLoading}
                />
                <button type="submit" className="send-button" disabled={isLoading}>➤</button>
              </form>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0a0a0f;
          color: #ffffff;
          min-height: 100vh;
        }

        /* Login Screen */
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
        }

        .login-card {
          background: #1a1a2e;
          padding: 3rem;
          border-radius: 16px;
          text-align: center;
          border: 1px solid #2a2a4e;
        }

        .login-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .login-card h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          color: #4ade80;
        }

        .login-card p {
          color: #888;
          margin-bottom: 2rem;
        }

        .password-input {
          width: 100%;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #333;
          background: #0a0a0f;
          color: white;
          font-size: 1rem;
          margin-bottom: 1rem;
        }

        .login-button {
          width: 100%;
          padding: 1rem;
          border-radius: 8px;
          border: none;
          background: #4ade80;
          color: #0a0a0f;
          font-weight: bold;
          cursor: pointer;
          font-size: 1rem;
        }

        /* Dashboard */
        .dashboard {
          min-height: 100vh;
          padding: 1rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0;
          border-bottom: 1px solid #2a2a4e;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header h1 {
          font-size: 1.5rem;
          color: #4ade80;
        }

        .subtitle {
          color: #666;
          font-size: 0.85rem;
        }

        .tabs {
          display: flex;
          gap: 0.5rem;
        }

        .tab {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          border: 1px solid #333;
          background: transparent;
          color: #888;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .tab.active {
          background: #4ade80;
          color: #0a0a0f;
          border-color: #4ade80;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 1.5rem;
        }

        @media (max-width: 1024px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        .left-column, .right-column {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Cards */
        .card {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 1.25rem;
          border: 1px solid #2a2a4e;
        }

        .card-title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #fff;
        }

        .card-subtitle {
          font-size: 0.75rem;
          color: #666;
          margin-bottom: 1rem;
        }

        /* Table */
        .table-wrapper {
          overflow-x: auto;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .table th {
          text-align: left;
          padding: 0.5rem;
          color: #666;
          font-weight: 500;
          border-bottom: 1px solid #333;
        }

        .table td {
          padding: 0.5rem;
          border-bottom: 1px solid #222;
        }

        .table tr.top-four {
          background: rgba(74, 222, 128, 0.05);
        }

        .table tr.relegation {
          background: rgba(239, 68, 68, 0.05);
        }

        .team-name {
          font-weight: 500;
        }

        .points {
          font-weight: bold;
          color: #4ade80;
        }

        .positive { color: #4ade80; }
        .negative { color: #ef4444; }

        .form {
          display: flex;
          gap: 2px;
        }

        .form-badge {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: bold;
        }

        .form-badge.w { background: #4ade80; color: #000; }
        .form-badge.d { background: #facc15; color: #000; }
        .form-badge.l { background: #ef4444; color: #fff; }

        /* Fixtures */
        .fixtures {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .fixture-row {
          background: #0a0a0f;
          border-radius: 8px;
          padding: 1rem;
          border: 1px solid #222;
        }

        .fixture-teams {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .home-team, .away-team {
          font-weight: 500;
          flex: 1;
        }

        .home-team { text-align: left; }
        .away-team { text-align: right; }

        .vs {
          color: #666;
          font-size: 0.8rem;
        }

        .fixture-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #666;
          margin-bottom: 0.5rem;
        }

        .confidence {
          color: #facc15;
        }

        .prediction {
          margin-bottom: 0.5rem;
        }

        .pick {
          background: #4ade80;
          color: #000;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: bold;
        }

        .odds-row {
          display: flex;
          gap: 0.5rem;
          font-size: 0.75rem;
        }

        .odd {
          color: #888;
          padding: 0.25rem 0.5rem;
          background: #1a1a2e;
          border-radius: 4px;
        }

        .odd.high {
          color: #4ade80;
        }

        /* Chat */
        .chat-card {
          display: flex;
          flex-direction: column;
          height: 500px;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding-right: 0.5rem;
          margin-bottom: 1rem;
        }

        .message {
          margin-bottom: 1rem;
        }

        .message.user {
          text-align: right;
        }

        .message-content {
          display: inline-block;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          max-width: 90%;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .message.user .message-content {
          background: #4ade80;
          color: #000;
        }

        .message.assistant .message-content {
          background: #2a2a4e;
          color: #fff;
        }

        .typing {
          color: #666;
          font-style: italic;
        }

        .chat-input-form {
          display: flex;
          gap: 0.5rem;
        }

        .chat-input {
          flex: 1;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid #333;
          background: #0a0a0f;
          color: white;
          font-size: 0.9rem;
        }

        .send-button {
          padding: 0.75rem 1.25rem;
          border-radius: 8px;
          border: none;
          background: #4ade80;
          color: #000;
          font-weight: bold;
          cursor: pointer;
        }

        /* Picks */
        .picks-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .pick-item {
          background: #0a0a0f;
          padding: 1rem;
          border-radius: 8px;
          border-left: 3px solid #facc15;
        }

        .pick-item.high-confidence {
          border-left-color: #4ade80;
        }

        .pick-team {
          font-weight: 600;
          display: block;
          margin-bottom: 0.25rem;
        }

        .pick-reason {
          font-size: 0.8rem;
          color: #888;
          display: block;
          margin-bottom: 0.25rem;
        }

        .pick-odds {
          font-size: 0.8rem;
          color: #4ade80;
          font-weight: bold;
        }

        /* Racing */
        .racing-coming-soon {
          max-width: 600px;
          margin: 2rem auto;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
        }

        .empty-state-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .empty-state h2 {
          margin-bottom: 0.5rem;
        }

        .empty-state p {
          color: #888;
        }

        .subtext {
          font-size: 0.85rem;
          margin-top: 0.5rem;
        }

        /* Loading */
        .loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #333;
          border-top-color: #4ade80;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: #0a0a0f;
        }

        ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #444;
        }

        /* South America */
        .card-header-brazil {
          border-left: 4px solid #facc15;
          padding-left: 0.75rem;
          margin-bottom: 1rem;
        }

        .card-header-argentina {
          border-left: 4px solid #60a5fa;
          padding-left: 0.75rem;
          margin-bottom: 1rem;
        }

        .data-badge {
          font-size: 0.75rem;
          color: #888;
          display: block;
          margin-top: 0.25rem;
        }

        .sa-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .sa-stat {
          background: #0a0a0f;
          padding: 0.75rem;
          border-radius: 8px;
          text-align: center;
        }

        .sa-stat-value {
          display: block;
          font-size: 1.25rem;
          font-weight: bold;
          color: #4ade80;
        }

        .sa-stat-label {
          font-size: 0.7rem;
          color: #666;
        }

        .sa-section-title {
          font-size: 0.85rem;
          color: #888;
          margin: 1rem 0 0.5rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sa-teams-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .sa-team-badge {
          background: #1a1a2e;
          padding: 0.4rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8rem;
          color: #ddd;
        }

        .sa-prediction {
          background: #0a0a0f;
          border-radius: 8px;
          padding: 1rem;
        }

        .sa-pred-row {
          display: flex;
          justify-content: space-between;
          padding: 0.4rem 0;
          border-bottom: 1px solid #1a1a2e;
        }

        .sa-pred-row:last-child {
          border-bottom: none;
        }

        .sa-pred-value {
          font-weight: bold;
          color: #4ade80;
        }

        .sa-note {
          font-size: 0.75rem;
          color: #666;
          margin-top: 1rem;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
