import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
  
  return NextResponse.json({
    hasKey: !!MINIMAX_API_KEY,
    keyPrefix: MINIMAX_API_KEY.substring(0, 10),
    keyLength: MINIMAX_API_KEY.length
  })
}

export async function POST(req: NextRequest) {
  const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
  const body = await req.json()
  const { testUrl, testKey } = body
  
  const key = testKey || MINIMAX_API_KEY
  const url = testUrl || 'https://api.minimax.io/anthropic/chat/completions'
  
  if (!key) {
    return NextResponse.json({ error: 'No API key available' }, { status: 400 })
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [{ role: 'user', content: 'Say hi' }],
        max_tokens: 50
      })
    })
    
    const text = await response.text()
    
    return NextResponse.json({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: text.substring(0, 500)
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      type: error.cause?.constructor.name
    })
  }
}
