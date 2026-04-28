import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Betting AI | Premier League & HK Racing Predictions',
  description: 'AI-powered sports predictions powered by MiniMax',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
