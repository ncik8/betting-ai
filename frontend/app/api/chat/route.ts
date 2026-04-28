import { NextRequest, NextResponse } from 'next/server'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const MINIMAX_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2'

export async function POST(req: NextRequest) {
  try {
    const { message, context } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    // If no API key, return mock response
    if (!MINIMAX_API_KEY) {
      return NextResponse.json({ 
        response: "AI is not configured yet. Please add your MiniMax API key to .env.local" 
      })
    }

    const systemPrompt = `You are a casual football betting assistant for friends. 

LIVE TABLE DATA:
${context}

RULES:
- Use SIMPLE language, not betting jargon
- Explain any terms in plain English (e.g. "BTTS = Both Teams To Score" or "Both teams scoring at least once")
- Be friendly and chatty like you're talking to a mate at the pub
- Keep it concise
- When giving predictions, explain WHY in simple terms
- If asked about betting options, use simple names not codes
- Say things like "yeah probably" or "hard to call" when uncertain
- Don't be overly formal

SIMPLE BETTING NAMES:
- 1X2 = Home win / Draw / Away win
- BTTS = Both teams scoring (yes/no)
- Over/Under = More or fewer goals than X
- Correct Score = Exact final score
- Double Chance = Two of three possible results
- Asian Handicap = Giving one team a head start
- Corners = Total corner kicks
- HT/FT = Half time / Full time result
- Cards = Total yellow/red cards`

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
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('MiniMax API error:', response.status, error)
      return NextResponse.json({ 
        error: 'MiniMax API error',
        status: response.status,
        body: error,
        url: MINIMAX_URL
      }, { status: 500 })
    }

    const data = await response.json()
    
    // MiniMax API response format
    let aiResponse = data.choices?.[0]?.message?.content 
                  || data.choices?.[0]?.text?.content
                  || data.output?.text
                  || null
    
    if (!aiResponse) {
      console.error('MiniMax unexpected response:', JSON.stringify(data))
      return NextResponse.json({ 
        response: "Sorry, I couldn't process that. Try asking about a specific match or team!" 
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
