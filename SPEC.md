# Betting AI - Project Specification

## Overview
AI-powered sports prediction platform for Premier League (UK) and HK Horse Racing.

## Tech Stack
- **Frontend**: Next.js 14 (dark theme, football pitch green + trophy gold)
- **Backend**: Python FastAPI
- **Database**: Supabase PostgreSQL
- **Data Sources**: API-Football (Premier League), HKJC/Racing websites (scraping)

## Features
### Premier League Predictions
Per match, all betting markets:
- 1X2 (Home Win / Draw / Away Win)
- Over/Under 2.5 Goals
- Both Teams To Score (Yes/No)
- Correct Score
- Double Chance
- Asian Handicap

### HK Horse Racing Predictions
Per race, all betting markets:
- Win / Place / Show
- Quinella
- Trifecta
- Quartet

## Data Sources
- **Football**: API-Football (rapidapi.com)
- **HK Racing**: Scraping HKJC race cards + weather for Sha Tin / Happy Valley
- **Weather**: OpenWeatherMap API

## Racing Schedule (HK)
- Racing only on **Wednesday** (Happy Valley) and **Saturday/Sunday** (Sha Tin)
- Need weather for specific venue depending on race day

## User Flow
1. User visits website → sees today's matches/races
2. Clicks on a game/race → sees all AI predictions for that event
3. Each prediction shows: market, prediction, confidence %, key factors

## Supabase Schema
- `matches` - Premier League match data
- `races` - HK Racing race data
- `predictions` - AI predictions per market
- `results` - Actual outcomes for tracking accuracy
- `users` - User accounts (future)

## To Do
- [x] Project structure
- [ ] Supabase schema setup
- [ ] Premier League scraper
- [ ] HK Racing scraper (HKJC + weather)
- [ ] Prediction engine (ML/statistical)
- [ ] FastAPI endpoints
- [ ] Next.js frontend
- [ ] Telegram bot (future)
