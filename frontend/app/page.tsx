'use client'

import { useState, useEffect, useRef } from 'react'

// Password protection
const CORRECT_PASSWORD = 'football2024'

// API Base URLs
const API_BASE = '/api/football'
const SOFASCORE_BASE = '/api/sofascore'
const HK_RACING_BASE = '/api/hk-racing'

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
}

// Fallback PL data
const FALLBACK_PL_TABLE = [
  { pos: 1, team: 'Liverpool', pts: 84, gd: 45, played: 34, form: 'WWWWW' },
  { pos: 2, team: 'Arsenal', pts: 74, gd: 38, played: 34, form: 'WWLWL' },
  { pos: 3, team: 'Man City', pts: 71, gd: 37, played: 34, form: 'DDWWW' },
  { pos: 4, team: 'Chelsea', pts: 69, gd: 22, played: 34, form: 'WDWLW' },
  { pos: 5, team: 'Newcastle', pts: 66, gd: 18, played: 34, form: 'DLWWW' },
  { pos: 6, team: 'Aston Villa', pts: 58, gd: 5, played: 34, form: 'LWDWL' },
  { pos: 7, team: 'Brighton', pts: 50, gd: 9, played: 34, form: 'WWWDW' },
  { pos: 8, team: 'Bournemouth', pts: 49, gd: 0, played: 34, form: 'DDWWD' },
  { pos: 9, team: 'Brentford', pts: 48, gd: 3, played: 34, form: 'DDDDL' },
  { pos: 10, team: 'Fulham', pts: 48, gd: -2, played: 34, form: 'DWLDW' },
  { pos: 11, team: 'Everton', pts: 47, gd: 0, played: 34, form: 'LWDLL' },
  { pos: 12, team: 'Crystal Palace', pts: 46, gd: -6, played: 34, form: 'LWWLL' },
  { pos: 13, team: 'Sunderland', pts: 43, gd: -9, played: 34, form: 'WDWDL' },
  { pos: 14, team: 'Man United', pts: 42, gd: -4, played: 34, form: 'WLLWW' },
  { pos: 15, team: 'West Ham', pts: 40, gd: -7, played: 34, form: 'DDWWD' },
  { pos: 16, team: 'Tottenham', pts: 39, gd: -4, played: 34, form: 'DWDWW' },
  { pos: 17, team: 'Leeds', pts: 36, gd: -16, played: 34, form: 'DLWDL' },
  { pos: 18, team: 'Nottm Forest', pts: 34, gd: -10, played: 34, form: 'DLLDW' },
  { pos: 19, team: 'Burnley', pts: 20, gd: -34, played: 34, form: 'DLLLL' },
  { pos: 20, team: 'Wolves', pts: 17, gd: -38, played: 34, form: 'WDLLL' },
]

const FALLBACK_PL_FIXTURES = [
  { home: 'Arsenal', away: 'Fulham', date: '03 May', time: '00:30', homeWin: 67, draw: 25, awayWin: 8, over25: 65, btts: 52, corners: 12 },
  { home: 'Man United', away: 'Liverpool', date: '03 May', time: '22:30', homeWin: 13, draw: 38, awayWin: 49, over25: 63, btts: 50, corners: 12 },
  { home: 'Bournemouth', away: 'Crystal Palace', date: '03 May', time: '21:00', homeWin: 28, draw: 40, awayWin: 32, over25: 61, btts: 50, corners: 11 },
  { home: 'Aston Villa', away: 'Tottenham', date: '04 May', time: '02:00', homeWin: 36, draw: 40, awayWin: 24, over25: 62, btts: 52, corners: 13 },
  { home: 'Chelsea', away: 'Nottm Forest', date: '04 May', time: '23:00', homeWin: 34, draw: 40, awayWin: 26, over25: 63, btts: 55, corners: 13 },
  { home: 'Everton', away: 'Man City', date: '04 May', time: '23:00', homeWin: 8, draw: 31, awayWin: 61, over25: 67, btts: 53, corners: 12 },
  { home: 'Sunderland', away: 'Brighton', date: '04 May', time: '21:00', homeWin: 29, draw: 40, awayWin: 31, over25: 62, btts: 51, corners: 11 },
  { home: 'Burnley', away: 'Leeds', date: '05 May', time: '00:30', homeWin: 21, draw: 40, awayWin: 39, over25: 58, btts: 48, corners: 10 },
  { home: 'Wolves', away: 'Brentford', date: '05 May', time: '02:00', homeWin: 21, draw: 40, awayWin: 39, over25: 61, btts: 49, corners: 11 },
  { home: 'Newcastle', away: 'West Ham', date: '05 May', time: '21:00', homeWin: 29, draw: 40, awayWin: 31, over25: 62, btts: 51, corners: 11 },
]

const CHAT_INTROS = {
  pl: 'Hi! Im your Premier League betting assistant. Ask me anything about this weekends matches!',
  brazil: 'Hi! Im your Brazil Serie A betting assistant. Ask me about Flamengo, Palmeiras, or any Brazilian matches!',
  argentina: 'Hi! Im your Argentina Liga Profesional betting assistant. Ask me about River Plate, Boca Juniors, or any Argentine matches!',
  racing: 'Hi! Im your HK Horse Racing assistant. Racing happens Wed (Happy Valley) and Sat/Sun (Sha Tin).'
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
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: CHAT_INTROS.pl }])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [plTable, setPlTable] = useState(FALLBACK_PL_TABLE)
  const [plFixtures, setPlFixtures] = useState(FALLBACK_PL_FIXTURES)
  const [selectedMatch, setSelectedMatch] = useState<any>(null)
  const [matchDetails, setMatchDetails] = useState<any>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [brazilTable, setBrazilTable] = useState<any[]>([])
  const [brazilFixtures, setBrazilFixtures] = useState<any[]>([])
  const [argentinaTable, setArgentinaTable] = useState<any[]>([])
  const [argentinaFixtures, setArgentinaFixtures] = useState<any[]>([])
  const [hkRacingData, setHkRacingData] = useState<any>(null)
  const [hkWeather, setHkWeather] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(false)

  const refreshRacingData = async () => {
    setDataLoading(true)
    try {
      const racingRes = await fetch(HK_RACING_BASE)
      const racingData = await racingRes.json()
      if (racingData.success && racingData.data) setHkRacingData(racingData.data)
    } catch (err) { console.error('HK Racing data error:', err) }
    setDataLoading(false)
  }

  const handleMatchClick = async (match: any) => {
    setSelectedMatch(match)
    setMatchLoading(true)
    setMatchDetails(null)

    try {
      // Try to fetch from FotMob API
      const res = await fetch(`/api/fotmob/match/${match.id || 'test'}`)
      const data = await res.json()
      if (data.success && data.data) {
        setMatchDetails(data.data)
      }
    } catch (err) {
      console.error('Match details error:', err)
    }

    setMatchLoading(false)
  }

  const handleAskAboutMatch = () => {
    if (!selectedMatch) return

    const matchText = selectedMatch.score
      ? `${selectedMatch.home} ${selectedMatch.score} ${selectedMatch.away}`
      : `${selectedMatch.home} vs ${selectedMatch.away}`

    setInput(`Tell me about ${matchText}`)
    setActiveTab('pl')
  }

  useEffect(() => {
    async function fetchData() {
      setDataLoading(true)
      try {
        const res = await fetch(API_BASE)
        const data = await res.json()
        if (data.table?.length > 0) setPlTable(data.table)
        if (data.fixtures?.length > 0) setPlFixtures(data.fixtures)
      } catch (err) { console.error('PL data error:', err) }

      try {
        const brazilRes = await fetch(`${SOFASCORE_BASE}?league=brazil`)
        const brazilData = await brazilRes.json()
        if (brazilData.standings) setBrazilTable(brazilData.standings)
        if (brazilData.fixtures) setBrazilFixtures(brazilData.fixtures)
      } catch (err) { console.error('Brazil data error:', err) }

      try {
        const argRes = await fetch(`${SOFASCORE_BASE}?league=argentina`)
        const argData = await argRes.json()
        if (argData.standings) setArgentinaTable(argData.standings)
        if (argData.fixtures) setArgentinaFixtures(argData.fixtures)
      } catch (err) { console.error('Argentina data error:', err) }

      try {
        const racingRes = await fetch(HK_RACING_BASE)
        const racingData = await racingRes.json()
        if (racingData.success && racingData.data) setHkRacingData(racingData.data)
      } catch (err) { console.error('HK Racing data error:', err) }

      try {
        const weatherRes = await fetch('/api/weather')
        const weatherData = await weatherRes.json()
        if (weatherData.success && weatherData.data) setHkWeather(weatherData.data)
      } catch (err) { console.error('HK Weather error:', err) }

      setDataLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { setMessages([{ role: 'assistant', content: CHAT_INTROS[activeTab] }]) }, [activeTab])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === CORRECT_PASSWORD) setIsAuthenticated(true)
    else alert('Incorrect password')
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    let context = ''
    if (activeTab === 'pl') {
      context = `Current Premier League Table:\n${plTable.map((t: any) => `${t.pos}. ${t.team} - ${t.pts}pts`).join('\n')}\n\nThis Weekends Matches:\n${plFixtures.length > 0 ? plFixtures.map((f: any) => `${f.home} vs ${f.away} (${f.date} ${f.time}) - 1X2: ${f.homeWin || 45}%/${f.draw || 30}%/${f.awayWin || 25}%, Over 2.5: ${f.over25 || 55}%, BTTS: ${f.btts || 50}%, Corners: ${f.corners || 11}`).join('\n') : 'Fixtures loading...'}`
    } else if (activeTab === 'brazil') {
      context = `Brazil Serie A Table:\n${brazilTable.length > 0 ? brazilTable.map((t: any) => `${t.pos}. ${t.team} - ${t.pts}pts`).join('\n') : 'Table loading...'}\n\nBrazil Serie A Stats (trained on ${BRAZIL_MODEL.totalMatches.toLocaleString()} matches):\n- Average Goals: ${BRAZIL_MODEL.avgGoals}\n- Home Win Rate: ${BRAZIL_MODEL.homeWinRate}%\n- Over 2.5 Rate: ${BRAZIL_MODEL.over25Rate}%\n- BTTS Rate: ${BRAZIL_MODEL.bttsRate}%`
    } else if (activeTab === 'argentina') {
      context = `Argentina Liga Profesional Table:\n${argentinaTable.length > 0 ? argentinaTable.map((t: any) => `${t.pos}. ${t.team} - ${t.pts}pts`).join('\n') : 'Table loading...'}\n\nArgentina Stats (trained on ${ARGENTINA_MODEL.totalMatches.toLocaleString()} matches):\n- Average Goals: ${ARGENTINA_MODEL.avgGoals}\n- Home Win Rate: ${ARGENTINA_MODEL.homeWinRate}%\n- Over 2.5 Rate: ${ARGENTINA_MODEL.over25Rate}%\n- BTTS Rate: ${ARGENTINA_MODEL.bttsRate}%`
    } else if (activeTab === 'racing') {
      context = `HK Racing data: ${hkRacingData ? JSON.stringify(hkRacingData) : 'No racing data today'}\n\nWeather: ${hkWeather ? JSON.stringify(hkWeather) : 'Loading weather...'}\n\nRacing schedule: Wed (Happy Valley), Sat/Sun (Sha Tin)`
    }

    ;(async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage, context })
        })
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      } catch (err) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, Im having trouble connecting. Try again!' }])
      } finally {
        setIsLoading(false)
      }
    })()
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-icon">SOCCER</div>
          <h1>Betting AI</h1>
          <p>Premier League Predictions</p>
          <form onSubmit={handleLogin}>
            <input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} className="password-input" />
            <button type="submit" className="login-button">Enter</button>
          </form>
        </div>
      </div>
    )
  }

  // Main Dashboard - render based on activeTab
  return (
    <div className="dashboard">
      <header className="header">
        <div className="header-content">
          <h1>Betting AI</h1>
          <p className="subtitle">Premier League | Brazil | Argentina | HK Racing</p>
        </div>
        <div className="tabs">
          <button className={`tab ${activeTab === 'pl' ? 'active' : ''}`} onClick={() => setActiveTab('pl')}>PL</button>
          <button className={`tab ${activeTab === 'brazil' ? 'active' : ''}`} onClick={() => setActiveTab('brazil')}>Brazil</button>
          <button className={`tab ${activeTab === 'argentina' ? 'active' : ''}`} onClick={() => setActiveTab('argentina')}>Argentina</button>
          <button className={`tab ${activeTab === 'racing' ? 'active' : ''}`} onClick={() => setActiveTab('racing')}>HK Racing</button>
        </div>
      </header>

      {activeTab === 'pl' && <PLContent {...{ plTable, plFixtures, dataLoading, messages, input, isLoading, chatEndRef, handleSendMessage, setInput, selectedMatch, matchDetails, matchLoading, handleMatchClick, handleAskAboutMatch }} />}
      {activeTab === 'brazil' && <BrazilContent {...{ brazilTable, brazilFixtures, dataLoading, messages, input, isLoading, chatEndRef, handleSendMessage, setInput }} />}
      {activeTab === 'argentina' && <ArgentinaContent {...{ argentinaTable, argentinaFixtures, dataLoading, messages, input, isLoading, chatEndRef, handleSendMessage, setInput }} />}
      {activeTab === 'racing' && <RacingContent {...{ hkRacingData, hkWeather, messages, input, isLoading, chatEndRef, handleSendMessage, setInput, refreshRacingData, dataLoading }} />}
    </div>
  )
}

// PL Content Component
function PLContent({ plTable, plFixtures, dataLoading, messages, input, isLoading, chatEndRef, handleSendMessage, setInput, selectedMatch, matchDetails, matchLoading, handleMatchClick, handleAskAboutMatch }: any) {
  return (
    <div className="content-grid">
      <div className="left-column">
        <div className="card">
          <div className="card-header-row">
            <h2 className="card-title">Live Table {dataLoading && '(Loading...)'}</h2>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead>
              <tbody>
                {plTable.map((team: any) => (
                  <tr key={team.pos} className={team.pos <= 4 ? 'top-four' : team.pos >= 18 ? 'relegation' : ''}>
                    <td>{team.pos}</td>
                    <td className="team-name">{team.team}</td>
                    <td>{team.played}</td>
                    <td className={team.gd > 0 ? 'positive' : team.gd < 0 ? 'negative' : ''}>{team.gd > 0 ? '+' : ''}{team.gd}</td>
                    <td className="points">{team.pts}</td>
                    <td className="form">{(team.form || '').split('').map((r: string, i: number) => <span key={i} className={`form-badge ${r.toLowerCase()}`}>{r}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Match Details Card */}
        {selectedMatch && (
          <div className="card match-details-card">
            <div className="card-header-row">
              <h2 className="card-title">
                {matchLoading ? 'Loading match data...' : `${selectedMatch.home} vs ${selectedMatch.away}`}
              </h2>
              <button onClick={() => { setSelectedMatch(null); setMatchDetails(null); }} className="close-btn">×</button>
            </div>

            {matchLoading && (
              <div className="loading-spinner">Fetching latest match data from FotMob...</div>
            )}

            {matchDetails && !matchLoading && (
              <>
                <div className="match-teams">
                  <div className="team-info">
                    <h3>{matchDetails.homeTeam?.name}</h3>
                    {matchDetails.homeTeam?.formation && <span className="formation">{matchDetails.homeTeam.formation}</span>}
                    {matchDetails.homeTeam?.score !== null && <span className="score">{matchDetails.homeTeam.score}</span>}
                  </div>
                  <div className="vs-small">vs</div>
                  <div className="team-info">
                    <h3>{matchDetails.awayTeam?.name}</h3>
                    {matchDetails.awayTeam?.formation && <span className="formation">{matchDetails.awayTeam.formation}</span>}
                    {matchDetails.awayTeam?.score !== null && <span className="score">{matchDetails.awayTeam.score}</span>}
                  </div>
                </div>

                <div className="match-meta">
                  {matchDetails.kickoffTime && <span>🕐 {new Date(matchDetails.kickoffTime).toLocaleString()}</span>}
                  {matchDetails.venue && <span>📍 {matchDetails.venue}</span>}
                  {matchDetails.referee && <span>👤 {matchDetails.referee}</span>}
                </div>

                <div className="lineup-status">
                  {matchDetails.homeTeam?.lineupAvailable ? (
                    <span className="lineup-available">✅ Lineup available</span>
                  ) : (
                    <span className="lineup-tba">⏳ Lineup not yet published</span>
                  )}
                </div>

                {matchDetails.homeTeam?.lineup && (
                  <div className="lineup-section">
                    <h4>{matchDetails.homeTeam.name} Lineup:</h4>
                    <div className="lineup-players">
                      {matchDetails.homeTeam.lineup.map((p: string, i: number) => (
                        <span key={i} className="player-badge">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {matchDetails.awayTeam?.lineup && (
                  <div className="lineup-section">
                    <h4>{matchDetails.awayTeam.name} Lineup:</h4>
                    <div className="lineup-players">
                      {matchDetails.awayTeam.lineup.map((p: string, i: number) => (
                        <span key={i} className="player-badge">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {matchDetails.keyPlayers?.length > 0 && (
                  <div className="key-players">
                    <h4>Key Players:</h4>
                    <div className="key-players-list">
                      {matchDetails.keyPlayers.map((p: string, i: number) => (
                        <span key={i} className="player-badge key">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {matchDetails.lastMeetings?.length > 0 && (
                  <div className="h2h-section">
                    <h4>Recent Meetings:</h4>
                    {matchDetails.lastMeetings.map((m: any, i: number) => (
                      <div key={i} className="h2h-match">
                        {m.home} {m.score} {m.away} ({m.date})
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <button onClick={handleAskAboutMatch} className="ask-ai-btn">
              Ask AI About This Match
            </button>
          </div>
        )}

        <div className="card">
          <div className="card-header-row">
            <h2 className="card-title">This Weekends Matches</h2>
            <button onClick={() => {}} className="refresh-btn">↻</button>
          </div>
          <div className="fixtures">
            {plFixtures.length > 0 ? plFixtures.map((match: any, i: number) => {
              const isSelected = selectedMatch?.home === match.home && selectedMatch?.away === match.away;
              return (
                <div
                  key={i}
                  className={`fixture-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleMatchClick(match)}
                >
                  <div className="fixture-teams">
                    <span className={`home-team ${isSelected ? 'selected-team' : ''}`}>{match.home}</span>
                    <span className="vs">vs</span>
                    <span className={`away-team ${isSelected ? 'selected-team' : ''}`}>{match.away}</span>
                    {match.status === 'FT' && <span className="status-badge ft">FT</span>}
                    {match.status === 'LIVE' && <span className="status-badge live">LIVE</span>}
                    {match.status === 'NS' && <span className="status-badge ns">{match.time}</span>}
                  </div>
                  {match.score && <div className="fixture-score">{match.score}</div>}
                  <div className="fixture-hint">Click to load match details →</div>
                </div>
              )
            }) : <div className="empty-state">Loading fixtures...</div>}
          </div>
        </div>
      </div>
      <ChatPanel {...{ messages, input, isLoading, chatEndRef, handleSendMessage, setInput, title: 'AI Assistant' }} />
    </div>
  )
}

// Brazil Content Component
function BrazilContent({ brazilTable, brazilFixtures, dataLoading, messages, input, isLoading, chatEndRef, handleSendMessage, setInput }: any) {
  return (
    <div className="content-grid">
      <div className="left-column">
        <div className="card">
          <h2 className="card-title">Brazil Serie A Table {dataLoading && '(Loading...)'}</h2>
          <p className="card-subtitle">LIVE 2026 Season via Sofascore</p>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
              <tbody>
                {brazilTable.length > 0 ? brazilTable.map((team: any) => (
                  <tr key={team.pos}><td>{team.pos}</td><td className="team-name">{team.team}</td><td>{team.played}</td><td className={team.gd > 0 ? 'positive' : team.gd < 0 ? 'negative' : ''}>{team.gd > 0 ? '+' : ''}{team.gd}</td><td className="points">{team.pts}</td></tr>
                )) : <tr><td colSpan={5} style={{textAlign:'center'}}>Loading table...</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">ML Model Stats</h2>
          <span className="data-badge">{BRAZIL_MODEL.totalMatches.toLocaleString()} matches trained | {BRAZIL_MODEL.seasons} seasons</span>
          <div className="sa-stats">
            <div className="sa-stat"><span className="sa-stat-value">{BRAZIL_MODEL.avgGoals}</span><span className="sa-stat-label">Avg Goals</span></div>
            <div className="sa-stat"><span className="sa-stat-value">{BRAZIL_MODEL.homeWinRate}%</span><span className="sa-stat-label">Home Win</span></div>
            <div className="sa-stat"><span className="sa-stat-value">{BRAZIL_MODEL.over25Rate}%</span><span className="sa-stat-label">Over 2.5</span></div>
            <div className="sa-stat"><span className="sa-stat-value">{BRAZIL_MODEL.bttsRate}%</span><span className="sa-stat-label">BTTS</span></div>
          </div>
          <h3 className="sa-section-title">Top Teams</h3>
          <div className="sa-teams-grid">{BRAZIL_MODEL.topTeams.map((team, i) => <span key={i} className="sa-team-badge">{team}</span>)}</div>
        </div>
        <div className="card">
          <h2 className="card-title">This Weeks Matches</h2>
          <div className="fixtures">
            {brazilFixtures.length > 0 ? brazilFixtures.map((match: any, i: number) => (
              <div key={i} className="fixture-row">
                <div className="fixture-teams"><span className="home-team">{match.home}</span><span className="vs">vs</span><span className="away-team">{match.away}</span></div>
                <div className="fixture-meta"><span>{match.date} {match.time}</span></div>
              </div>
            )) : <div className="empty-state">Loading fixtures...</div>}
          </div>
        </div>
      </div>
      <ChatPanel {...{ messages, input, isLoading, chatEndRef, handleSendMessage, setInput, title: 'Brazil Serie A AI' }} />
    </div>
  )
}

// Argentina Content Component
function ArgentinaContent({ argentinaTable, argentinaFixtures, dataLoading, messages, input, isLoading, chatEndRef, handleSendMessage, setInput }: any) {
  return (
    <div className="content-grid">
      <div className="left-column">
        <div className="card">
          <h2 className="card-title">Argentina Liga Table {dataLoading && '(Loading...)'}</h2>
          <p className="card-subtitle">LIVE 2026 Season via Sofascore</p>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
              <tbody>
                {argentinaTable.length > 0 ? argentinaTable.map((team: any) => (
                  <tr key={team.pos}><td>{team.pos}</td><td className="team-name">{team.team}</td><td>{team.played}</td><td className={team.gd > 0 ? 'positive' : team.gd < 0 ? 'negative' : ''}>{team.gd > 0 ? '+' : ''}{team.gd}</td><td className="points">{team.pts}</td></tr>
                )) : <tr><td colSpan={5} style={{textAlign:'center'}}>Loading table...</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">ML Model Stats</h2>
          <span className="data-badge">{ARGENTINA_MODEL.totalMatches.toLocaleString()} matches trained | {ARGENTINA_MODEL.seasons} seasons</span>
          <div className="sa-stats">
            <div className="sa-stat"><span className="sa-stat-value">{ARGENTINA_MODEL.avgGoals}</span><span className="sa-stat-label">Avg Goals</span></div>
            <div className="sa-stat"><span className="sa-stat-value">{ARGENTINA_MODEL.homeWinRate}%</span><span className="sa-stat-label">Home Win</span></div>
            <div className="sa-stat"><span className="sa-stat-value">{ARGENTINA_MODEL.over25Rate}%</span><span className="sa-stat-label">Over 2.5</span></div>
            <div className="sa-stat"><span className="sa-stat-value">{ARGENTINA_MODEL.bttsRate}%</span><span className="sa-stat-label">BTTS</span></div>
          </div>
          <h3 className="sa-section-title">Top Teams</h3>
          <div className="sa-teams-grid">{ARGENTINA_MODEL.topTeams.map((team, i) => <span key={i} className="sa-team-badge">{team}</span>)}</div>
        </div>
        <div className="card">
          <h2 className="card-title">This Weeks Matches</h2>
          <div className="fixtures">
            {argentinaFixtures.length > 0 ? argentinaFixtures.map((match: any, i: number) => (
              <div key={i} className="fixture-row">
                <div className="fixture-teams"><span className="home-team">{match.home}</span><span className="vs">vs</span><span className="away-team">{match.away}</span></div>
                <div className="fixture-meta"><span>{match.date} {match.time}</span></div>
              </div>
            )) : <div className="empty-state">Loading fixtures...</div>}
          </div>
        </div>
      </div>
      <ChatPanel {...{ messages, input, isLoading, chatEndRef, handleSendMessage, setInput, title: 'Argentina Liga AI' }} />
    </div>
  )
}

// Racing Content Component
function RacingContent({ hkRacingData, hkWeather, messages, input, isLoading, chatEndRef, handleSendMessage, setInput, refreshRacingData, dataLoading }: any) {
  return (
    <div className="content-grid">
      <div className="left-column">
        <div className="card">
          <div className="card-header-row">
            <h2 className="card-title">HK Horse Racing</h2>
            <button onClick={refreshRacingData} className="refresh-btn" disabled={dataLoading}>
              {dataLoading ? '...' : '↻'}
            </button>
          </div>
          <p className="card-subtitle">Racing happens Wed (Happy Valley) and Sat/Sun (Sha Tin)</p>
          {hkWeather && (
            <div className="weather-info">
              <h3>Current Weather</h3>
              {Object.entries(hkWeather).map(([key, w]: [string, any]) => (
                <div key={key} className="weather-card">
                  <h4>{w.venue}</h4>
                  <p>{w.condition}, {w.temperature}C</p>
                  <p>Humidity: {w.humidity}% | Wind: {w.windSpeed}km/h</p>
                  <p>Rain: {w.precipitation}mm</p>
                  <p className="grass-tip">Grass: {w.grassCondition}</p>
                  <p className="racing-tip">{w.racingAdvice}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {hkRacingData && Object.keys(hkRacingData).length > 0 ? (
          Object.entries(hkRacingData).map(([venue, data]: [string, any]) => (
            <div key={venue} className="card">
              <h2 className="card-title">{venue} Racecard</h2>
              {data.races && data.races.map((r: any, i: number) => (
                <div key={i} className="race-card">
                  <h3>Race {i + 1} - {r.time}</h3>
                  <p className="race-name">{r.race_name}</p>
                  <div className="horses-list">
                    {r.horses && r.horses.slice(0, 8).map((h: any, j: number) => (
                      <div key={j} className="horse-row">
                        <span className="horse-draw">#{h.draw}</span>
                        <span className="horse-name">{h.name}</span>
                        <span className="horse-odds">Odds: {h.odds}</span>
                        <span className="horse-form">Form: {h.form}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="card">
            <div className="empty-state">
              <p>No racing data today.</p>
              <p className="subtext">Next race day: Wednesday (Happy Valley) or Saturday/Sunday (Sha Tin)</p>
              <button onClick={refreshRacingData} className="refresh-btn-large" disabled={dataLoading}>
                {dataLoading ? 'Loading...' : 'Refresh Data'}
              </button>
            </div>
          </div>
        )}
      </div>
      <ChatPanel {...{ messages, input, isLoading, chatEndRef, handleSendMessage, setInput, title: 'HK Racing AI' }} />
    </div>
  )
}

// Chat Panel Component
function ChatPanel({ messages, input, isLoading, chatEndRef, handleSendMessage, setInput, title }: any) {
  return (
    <div className="right-column">
      <div className="card chat-card">
        <h2 className="card-title">{title}</h2>
        <div className="chat-messages">
          {messages.map((msg: Message, i: number) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
          {isLoading && <div className="message assistant"><div className="message-content typing">Thinking...</div></div>}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the AI..." className="chat-input" disabled={isLoading} />
          <button type="submit" className="send-button" disabled={isLoading}>Send</button>
        </form>
      </div>
    </div>
  )
}
