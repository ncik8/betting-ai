"""
Live Premier League Data Scraper
Gets: Current table, form, next matches
"""

import httpx
from bs4 import BeautifulSoup
import json
from datetime import datetime

class PremierLeagueScraper:
    """Scrape live Premier League data"""
    
    BASE_URL = "https://www.premierleague.com"
    
    def __init__(self):
        self.client = httpx.Client(timeout=30.0)
    
    def get_table(self) -> dict:
        """Get current Premier League table"""
        print("Fetching Premier League table...")
        
        try:
            response = self.client.get(f"{self.BASE_URL}/table")
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find table data
            rows = soup.find_all('tr', class_='standing-row')
            
            table = []
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 8:
                    team = cols[1].get_text(strip=True)
                    played = cols[2].get_text(strip=True)
                    won = cols[3].get_text(strip=True)
                    drawn = cols[4].get_text(strip=True)
                    lost = cols[5].get_text(strip=True)
                    gf = cols[6].get_text(strip=True)
                    ga = cols[7].get_text(strip=True)
                    gd = cols[8].get_text(strip=True)
                    points = cols[9].get_text(strip=True)
                    
                    table.append({
                        "position": len(table) + 1,
                        "team": team,
                        "played": int(played),
                        "won": int(won),
                        "drawn": int(drawn),
                        "lost": int(lost),
                        "gf": int(gf),
                        "ga": int(ga),
                        "gd": int(gd),
                        "points": int(points),
                        "form": self._get_form(row)
                    })
            
            return {"success": True, "data": table, "timestamp": datetime.now().isoformat()}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _get_form(self, row) -> list:
        """Get last 5 results from form column"""
        try:
            form_col = row.find('td', class_='form')
            if form_col:
                forms = form_col.find_all('a')
                return [f.get_text(strip=True) for f in forms[-5:]]
        except:
            pass
        return []
    
    def get_fixtures(self, matchday: int = None) -> dict:
        """Get upcoming fixtures"""
        print("Fetching fixtures...")
        
        try:
            url = f"{self.BASE_URL}/fixtures"
            if matchday:
                url = f"{self.BASE_URL}/fixtures?matchweek={matchday}"
            
            response = self.client.get(url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            fixtures = []
            matches = soup.find_all('div', class_='fixture')
            
            for match in matches:
                home = match.find('span', class_='home')
                away = match.find('span', class_='away')
                kickoff = match.find('span', class_='ko-time')
                
                if home and away:
                    fixtures.append({
                        "home": home.get_text(strip=True),
                        "away": away.get_text(strip=True),
                        "time": kickoff.get_text(strip=True) if kickoff else "TBD"
                    })
            
            return {"success": True, "data": fixtures, "timestamp": datetime.now().isoformat()}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_team_form(self, team_name: str) -> dict:
        """Get detailed form for a specific team"""
        try:
            # Search for team page
            search_url = f"{self.BASE_URL}/teams/{team_name.lower().replace(' ', '-')}"
            response = self.client.get(search_url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Get recent results
            results = soup.find_all('div', class_='result')
            recent = []
            
            for r in results[:5]:
                home_score = r.find('span', class_='home-score')
                away_score = r.find('span', class_='away-score')
                if home_score and away_score:
                    recent.append({
                        "home": home_score.get_text(strip=True),
                        "away": away_score.get_text(strip=True)
                    })
            
            return {"success": True, "team": team_name, "recent": recent}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_live_odds(self) -> dict:
        """Get betting odds from OddsChecker or similar"""
        # Note: Most odds sites block scraping
        # This would need an API like OddsChecker or BetBrain
        return {
            "success": False, 
            "error": "Odds scraping blocked. Consider API-Football or OddsChecker API."
        }


def main():
    scraper = PremierLeagueScraper()
    
    print("=" * 50)
    print("PREMIER LEAGUE LIVE DATA")
    print("=" * 50)
    
    # Get table
    print("\n[1] CURRENT TABLE")
    result = scraper.get_table()
    
    if result["success"]:
        print(f"\n{'Pos':<4} {'Team':<20} {'P':<4} {'W':<4} {'D':<4} {'L':<4} {'GD':<4} {'Pts':<4}")
        print("-" * 50)
        for team in result["data"][:10]:
            print(f"{team['position']:<4} {team['team']:<20} {team['played']:<4} {team['won']:<4} {team['drawn']:<4} {team['lost']:<4} {team['gd']:<4} {team['points']:<4}")
        print("...")
        print(f"\nUpdated: {result['timestamp']}")
    else:
        print(f"Error: {result['error']}")
    
    print("\n[2] NEXT FIXTURES")
    fixtures = scraper.get_fixtures()
    if fixtures["success"]:
        for f in fixtures["data"][:5]:
            print(f"  {f['home']} vs {f['away']} - {f['time']}")


if __name__ == "__main__":
    main()
