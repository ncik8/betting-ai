import { NextRequest, NextResponse } from 'next/server'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const MINIMAX_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'

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

    const systemPrompt = `You are a helpful Premier League football betting assistant. 

You have access to the following LIVE DATA:
${context}

Rules:
- Answer questions about Premier League matches, teams, and betting options
- Be concise but informative
- When discussing betting, mention confidence levels and key factors
- If someone asks about a match, reference the table position, form, and head-to-head
- Don't make up data - stick to what's provided above
- Be friendly and helpful
- If you don't have specific info, say so honestly`

    const response = await fetch(MINIMAX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
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
      console.error('MiniMax API error:', error)
      return NextResponse.json({ 
        response: 'Sorry, AI service is temporarily unavailable.' 
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
