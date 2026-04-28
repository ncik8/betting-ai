'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// Password protection
const CORRECT_PASSWORD = 'football2024'

// Live data from SkySports (scraped May 2026)
const LIVE_TABLE = [
  { pos: 1,  team: 'Arsenal',        pts: 73, gd: 38, played: 34, form: 'WWLWL' },
  { pos: 2,  team: 'Man City',       pts: 70, gd: 37, played: 33, form: 'DDWWW' },
  { pos: 3,  team: 'Man United',      pts: 61, gd: 14, played: 34, form: 'WDWLW' },
  { pos: 4,  team: 'Liverpool',       pts: 58, gd: 13, played: 34, form: 'DLWWW' },
  { pos: 5,  team: 'Aston Villa',     pts: 58, gd:  5, played: 34, form: 'LWDWL' },
  { pos: 6,  team: 'Brighton',        pts: 50, gd:  9, played: 34, form: 'WWWDW' },
  { pos: 7,  team: 'Bournemouth',     pts: 49, gd:  0, played: 34, form: 'DDWWD' },
  { pos: 8,  team: 'Chelsea',         pts: 48, gd:  8, played: 34, form: 'LLLLL' },
  { pos: 9,  team: 'Brentford',       pts: 48, gd:  3, played: 34, form: 'DDDDL' },
  { pos: 10, team: 'Fulham',          pts: 48, gd: -2, played: 34, form: 'DWLDW' },
  { pos: 11, team: 'Everton',         pts: 47, gd:  0, played: 34, form: 'LWDLL' },
  { pos: 12, team: 'Sunderland',      pts: 46, gd: -9, played: 34, form: 'LWWLL' },
  { pos: 13, team: 'Crystal Palace', pts: 43, gd: -3, played: 33, form: 'WDWDL' },
  { pos: 14, team: 'Newcastle',       pts: 42, gd: -4, played: 34, form: 'WLLWW' },
  { pos: 15, team: 'Leeds',           pts: 40, gd: -7, played: 34, form: 'DDWWD' },
  { pos: 16, team: 'Nottm Forest',    pts: 39, gd: -4, played: 34, form: 'DWDWW' },
  { pos: 17, team: 'West Ham',        pts: 36, gd:-16, played: 34, form: 'DLWDL' },
  { pos: 18, team: 'Tottenham',       pts: 34, gd:-10, played: 34, form: 'DLLDW' },
  { pos: 19, team: 'Burnley',         pts: 20, gd:-34, played: 34, form: 'DLLLL' },
  { pos: 20, team: 'Wolves',          pts: 17, gd:-38, played: 34, form: 'WDLLL' },
]

const WEEKEND_FIXTURES = [
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

// AI Chat
interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState<'football' | 'racing'>('football')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '👋 Hi! I\'m your Premier League betting assistant. Ask me anything about this weekend\'s matches!' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    // Build context with live data
    const context = `
Current Premier League Table:
${LIVE_TABLE.map(t => `${t.pos}. ${t.team} - ${t.pts}pts`).join('\n')}

This Weekend's Matches:
${WEEKEND_FIXTURES.map(f => `${f.home} vs ${f.away} (${f.date} ${f.time}) - 1X2: ${f.homeWin}%/${f.draw}%/${f.awayWin}%, Over 2.5: ${f.over25}%, BTTS: ${f.btts}%, Corners: ${f.corners}`).join('\n')}
`

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
          <p className="subtitle">Premier League Predictions • Updated Apr 29</p>
        </div>
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'football' ? 'active' : ''}`}
            onClick={() => setActiveTab('football')}
          >
            🏆 Football
          </button>
          <button 
            className={`tab ${activeTab === 'racing' ? 'active' : ''}`}
            onClick={() => setActiveTab('racing')}
          >
            🐴 HK Racing
          </button>
        </div>
      </header>

      {activeTab === 'football' && (
        <div className="content-grid">
          {/* Left Column: Table + Fixtures */}
          <div className="left-column">
            
            {/* Live Table */}
            <div className="card">
              <h2 className="card-title">📊 Live Table</h2>
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
                    {LIVE_TABLE.map((team) => (
                      <tr key={team.pos} className={team.pos <= 4 ? 'top-four' : team.pos >= 18 ? 'relegation' : ''}>
                        <td>{team.pos}</td>
                        <td className="team-name">{team.team}</td>
                        <td>{team.played}</td>
                        <td className={team.gd > 0 ? 'positive' : team.gd < 0 ? 'negative' : ''}>
                          {team.gd > 0 ? '+' : ''}{team.gd}
                        </td>
                        <td className="points">{team.pts}</td>
                        <td className="form">
                          {team.form.split('').map((r, i) => (
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
                {WEEKEND_FIXTURES.map((match, i) => {
                  const pick = match.homeWin > match.awayWin + 10 ? match.home : 
                              match.awayWin > match.homeWin + 10 ? match.away : 'Draw'
                  const confidence = Math.max(match.homeWin, match.draw, match.awayWin)
                  
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
                        <span className={`odd ${match.homeWin > 40 ? 'high' : ''}`}>
                          1: {match.homeWin}%
                        </span>
                        <span className="odd">
                          X: {match.draw}%
                        </span>
                        <span className={`odd ${match.awayWin > 40 ? 'high' : ''}`}>
                          2: {match.awayWin}%
                        </span>
                      </div>
                    </div>
                  )
                })}
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
      `}</style>
    </div>
  )
}
