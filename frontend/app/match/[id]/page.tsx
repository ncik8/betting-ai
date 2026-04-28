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
  [key: string]: Prediction | { [key: string]: Prediction }
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

export default function MatchPage() {
  const params = useParams()
  const matchId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''
  
  const [predictions, setPredictions] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null)

  useEffect(() => {
    if (matchId) {
      fetchPredictions()
    }
  }, [matchId])

  const fetchPredictions = async () => {
    try {
      // For demo, using mock data since we need actual API
      // In production, this would call the API with actual match data
      setPredictions({
        predictions: {
          "1X2": {
            "Home_Win": { probability: 0.52, odds: 1.92 },
            "Draw": { probability: 0.25, odds: 4.00 },
            "Away_Win": { probability: 0.23, odds: 4.35 }
          },
          "Over_Under_2.5": {
            "Over_2.5": { probability: 0.58, odds: 1.72 },
            "Under_2.5": { probability: 0.42, odds: 2.38 }
          },
          "BTTS": {
            "Yes": { probability: 0.55, odds: 1.82 },
            "No": { probability: 0.45, odds: 2.22 }
          }
        },
        ai_insights: {
          insights: "Arsenal have been in excellent form at home, winning their last 4 at the Emirates. Liverpool's defensive record away from home has been concerning, shipping goals in 3 of their last 5 away games. This suggests a high-scoring affair with Arsenal likely to edge it.",
          factors: [
            "Arsenal's 85% home win rate this season",
            "Liverpool's poor away defensive record",
            "Both teams scoring in 70% of their recent matches"
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
    if (prob >= 0.65) return { label: 'HIGH', class: 'confidence-high' }
    if (prob >= 0.50) return { label: 'MEDIUM', class: 'confidence-medium' }
    return { label: 'LOW', class: 'confidence-low' }
  }

  const formatProbability = (prob: number) => `${(prob * 100).toFixed(0)}%`

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  const marketTitles: { [key: string]: string } = {
    "1X2": "Match Result (1X2)",
    "Over_Under_2.5": "Over/Under 2.5 Goals",
    "BTTS": "Both Teams To Score",
    "Correct_Score": "Correct Score",
    "Double_Chance": "Double Chance",
    "Asian_Hicap": "Asian Handicap"
  }

  return (
    <main className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      {/* Back Link */}
      <Link href="/" className="btn btn-secondary" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
        ← Back to Dashboard
      </Link>

      {/* Match Header */}
      <div className="prediction-header">
        <h1>⚽ Match Predictions</h1>
        <p>Premier League</p>
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
          {Object.entries(predictions.predictions).map(([market, data]) => {
            const isSelected = selectedMarket === market || !selectedMarket && market === "1X2"
            
            if (!isSelected) return null
            
            return (
              <div key={market} className="market-section">
                <h3 className="market-title">
                  <span>📊</span> {marketTitles[market] || market}
                </h3>
                
                <div className="prediction-grid">
                  {Object.entries(data as Record<string, Prediction>).map(([selection, pred]) => {
                    const conf = getConfidenceBadge(pred.probability)
                    const isTop = pred.probability === Math.max(...Object.values(data as Record<string, Prediction>).map(p => p.probability))
                    
                    return (
                      <div key={selection} className={`prediction-item ${isTop ? 'top-pick' : ''}`}>
                        <div className="prediction-label">{selection.replace(/_/g, ' ')}</div>
                        <div className="prediction-prob">{formatProbability(pred.probability)}</div>
                        <div className="prediction-odds">Odds: {pred.odds}</div>
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
            ⚠️ Predictions are for informational purposes only. Please bet responsibly.
          </div>
        </div>
      )}
    </main>
  )
}
