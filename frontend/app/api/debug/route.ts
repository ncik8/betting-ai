import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
  
  const results: any = {
    hasKey: !!MINIMAX_API_KEY,
    keyPrefix: MINIMAX_API_KEY.substring(0, 10) + '...',
    keyLength: MINIMAX_API_KEY.length,
    endpoint: 'https://api.minimax.io/anthropic/chat/completions',
    model: 'MiniMax-M2.7'
  }
  
  if (!MINIMAX_API_KEY) {
    results.error = 'No API key found in environment'
    return NextResponse.json(results)
  }
  
  // Test MiniMax
  try {
    const response = await fetch(results.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: results.model,
        messages: [{ role: 'user', content: 'Say hi in 3 words' }],
        max_tokens: 50
      })
    })
    
    const text = await response.text()
    
    results.minimax = {
      status: response.status,
      body: text.substring(0, 300)
    }
  } catch (err: any) {
    results.minimax = {
      error: err.message
    }
  }
  
  return NextResponse.json(results)
}
