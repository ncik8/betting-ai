# 🏆 Betting AI

AI-powered sports predictions for **Premier League (UK)** and **HK Horse Racing**.

## Features

### ⚽ Premier League Predictions
- **1X2** - Home Win / Draw / Away Win
- **Over/Under 2.5 Goals**
- **Both Teams To Score**
- **Correct Score**
- **Double Chance**
- **Asian Handicap**

### 🐴 HK Horse Racing Predictions
- **Win / Place / Show**
- **Quinella** (Any order 1st-2nd)
- **Trifecta** (Exact order 1st-3rd)
- **Quartet** (Exact order 1st-4th)

## Tech Stack

- **Frontend**: Next.js 14 (Dark theme, sports green + gold)
- **Backend**: Python FastAPI
- **Database**: Supabase PostgreSQL
- **AI**: MiniMax API for enhanced insights
- **Data**: API-Football + HKJC Racing scrapers

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Supabase account

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your API keys

# Run server
uvicorn api.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Supabase Setup

1. Create a new Supabase project
2. Run the schema from `supabase/schema.sql`
3. Copy your Supabase URL and anon key to `.env`

## Environment Variables

```env
# Backend
RAPIDAPI_KEY=your_rapidapi_key          # For API-Football
MINIMAX_API_KEY=your_minimax_key        # For AI insights
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## API Endpoints

### Football
- `GET /api/v1/football/matches` - Today's matches
- `GET /api/v1/football/matches/{id}` - Match details
- `POST /api/v1/football/predict` - Get predictions

### Racing
- `GET /api/v1/racing/today` - Today's HK races
- `GET /api/v1/racing/dates/{date}` - Races by date
- `POST /api/v1/racing/predict` - Get predictions

### Dashboard
- `GET /api/v1/dashboard` - Combined today's data

## Racing Schedule

HK Horse Racing runs on:
- **Wednesday** - Happy Valley
- **Saturday/Sunday** - Sha Tin

## Disclaimer

Predictions are for **informational purposes only**. Please bet responsibly. This tool does not guarantee results.

## License

MIT
