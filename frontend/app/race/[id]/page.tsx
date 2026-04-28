'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

interface Prediction {
  probability: number
  odds: number
}

interface MarketPredictions {
  [key: string]: { [key: string]: Prediction }
}

interface PredictionData {
  predictions: MarketPredictions
  ai_insights?: {
    insights: string
    factors: string[]
    enhanced: boolean
  }
  market_count: number
  timestamp: string
}

export default function RacePage() {
  const params = useParams()
  const raceId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''
  
  const [predictions, setPredictions] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null)

  useEffect(() => {
    if (raceId) {
      fetchPredictions()
    }
  }, [raceId])

  const fetchPredictions = async () => {
    try {
      // For demo, using mock data
      // In production, this would call the API with actual race data
      setPredictions({
        predictions: {
          "Win_Place_Show": {
            "Champion Star 1": { probability: 0.22, odds: 4.55 },
            "Lucky Express 2": { probability: 0.18, odds: 5.56 },
            "Golden Power 3": { probability: 0.15, odds: 6.67 },
            "Thunder Bolt 4": { probability: 0.12, odds: 8.33 },
            "Happy Days 5": { probability: 0.10, odds: 10.00 }
          },
          "Quinella": {
            "Champion Star 1 & Lucky Express 2": { probability: 0.15, odds: 6.67 },
            "Champion Star 1 & Golden Power 3": { probability: 0.12, odds: 8.33 },
            "Lucky Express 2 & Golden Power 3": { probability: 0.10, odds: 10.00 },
            "Champion Star 1 & Thunder Bolt 4": { probability: 0.08, odds: 12.50 }
          },
          "Trifecta": {
            "Champion Star 1 - Lucky Express 2 - Golden Power 3": { probability: 0.035, odds: 28.57 },
            "Champion Star 1 - Lucky Express 2 - Thunder Bolt 4": { probability: 0.028, odds: 35.71 },
            "Lucky Express 2 - Champion Star 1 - Golden Power 3": { probability: 0.022, odds: 45.45 }
          }
        },
        ai_insights: {
          insights: "Champion Star has been in excellent form over 1200m, winning 2 of its last 3 starts. Lucky Express drawn well in barrier 2 and should appreciate the Good going. Golden Power is the value play for trifectas at longer odds.",
          factors: [
            "Champion Star's 75% win rate at 1200m this season",
            "Lucky Express excellent draw position",
            "Golden Power best value for exotic bets"
          ],
          enhanced: true
        },
        market_count: 3,
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      console.error('Failed to fetch predictions:', err)
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceBadge = (prob: number) => {
    if (prob >= 0.20) return { label: 'HIGH', class: 'confidence-high' }
    if (prob >= 0.10) return { label: 'MEDIUM', class: 'confidence-medium' }
    return { label: 'LOW', class: 'confidence-low' }
  }

  const formatProbability = (prob: number) => `${(prob * 100).toFixed(1)}%`

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  const marketTitles: { [key: string]: string } = {
    "Win_Place_Show": "Win / Place / Show",
    "Quinella": "Quinella (Any Order 1st-2nd)",
    "Trifecta": "Trifecta (Exact Order 1st-3rd)",
    "Quartet": "Quartet (Exact Order 1st-4th)"
  }

  return (
    <main className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      {/* Back Link */}
      <Link href="/" className="btn btn-secondary" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
        ← Back to Dashboard
      </Link>

      {/* Race Header */}
      <div className="prediction-header">
        <h1>🐴 Race Predictions</h1>
        <p>Hong Kong Horse Racing • Race {raceId?.split('_').pop() || '1'}</p>
      </div>

      {/* Predictions */}
      {predictions && (
        <div className="prediction-detail">
          {/* Market Tabs */}
          <div className="tabs">
            {Object.keys(predictions.predictions).map((market) => (
              <button
                key={market}
                className={`tab ${selectedMarket === market || !selectedMarket ? 'active' : ''}`}
                onClick={() => setSelectedMarket(market)}
              >
                {marketTitles[market] || market}
              </button>
            ))}
          </div>

          {/* Selected Market */}
          {Object.entries(predictions.predictions).map(([market, selections]) => {
            const isSelected = selectedMarket === market || !selectedMarket && market === "Win_Place_Show"
            
            if (!isSelected) return null
            
            return (
              <div key={market} className="market-section">
                <h3 className="market-title">
                  <span>📊</span> {marketTitles[market] || market}
                </h3>
                
                <div className="prediction-grid">
                  {Object.entries(selections).map(([selection, pred]) => {
                    const conf = getConfidenceBadge(pred.probability)
                    const isTop = pred.probability === Math.max(...Object.values(selections).map(p => p.probability))
                    
                    return (
                      <div key={selection} className={`prediction-item ${isTop ? 'top-pick' : ''}`}>
                        <div className="prediction-label" style={{ fontSize: '0.9rem' }}>{selection}</div>
                        <div className="prediction-prob">{formatProbability(pred.probability)}</div>
                        <div className="prediction-odds">Odds: {pred.odds.toFixed(2)}</div>
                        <span className={`confidence-badge ${conf.class}`}>{conf.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* AI Insights */}
          {predictions.ai_insights && (
            <div className="ai-insights">
              <div className="ai-insights-title">
                <span>🤖</span> AI Insights (Powered by MiniMax)
              </div>
              <div className="ai-insights-content">
                <p>{predictions.ai_insights.insights}</p>
                
                {predictions.ai_insights.factors.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <strong>Key Factors:</strong>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                      {predictions.ai_insights.factors.map((factor, i) => (
                        <li key={i}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ⚠️ Predictions are for informational purposes only. Please bet responsibly. HK racing markets carry risk.
          </div>
        </div>
      )}
    </main>
  )
}
