import { NextResponse } from 'next/server'

export async function GET() {
  const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
  
  const endpoints = [
    'https://api.minimax.io/anthropic/chat/completions',
    'https://api.minimax.io/anthropic/v1/chat/completions',
    'https://api.minimax.chat/v1/chat/completions',
    'https://api.minimax.chat/v1/text/chatcompletion_v2',
    'https://api.minimax.io/v1/text/chatcompletion_v2',
  ]
  
  const model = 'MiniMax-M2.7'
  const results: any = {}
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MINIMAX_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say hi' }],
          max_tokens: 20
        })
      })
      
      const text = await response.text()
      results[endpoint] = {
        status: response.status,
        body: text.substring(0, 200)
      }
    } catch (err: any) {
      results[endpoint] = { error: err.message }
    }
  }
  
  return NextResponse.json({ keyLength: MINIMAX_API_KEY.length, results })
}
