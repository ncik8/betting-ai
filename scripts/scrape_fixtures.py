"""
Scrape Premier League fixtures for the upcoming match round
Run by GitHub Actions cron job
"""

import requests
from bs4 import BeautifulSoup
import re
import json
from datetime import datetime, timedelta

# Get fixtures from flashscore
def get_fixtures():
    url = "https://www.flashscore.com/football/england/premier-league/"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        fixtures = []
        
        # Find match containers
        matches = soup.find_all('div', class_='event__match')
        
        for match in matches[:15]:  # Get next 15 matches
            try:
                time_elem = match.find('div', class_='event__time')
                home_elem = match.find('div', class_='event__home')
                away_elem = match.find('div', class_='event__away')
                
                if home_elem and away_elem:
                    home = home_elem.get_text(strip=True)
                    away = away_elem.get_text(strip=True)
                    time = time_elem.get_text(strip=True) if time_elem else ""
                    
                    fixtures.append({
                        'home': home,
                        'away': away,
                        'time': time
                    })
            except Exception as e:
                print(f"Error parsing match: {e}")
                continue
        
        return fixtures
        
    except Exception as e:
        print(f"Error fetching fixtures: {e}")
        return []

def update_fixtures_file(fixtures):
    """Update the page.tsx with new fixtures"""
    fixtures_json = json.dumps(fixtures, indent=2)
    
    # Read current page.tsx
    with open('frontend/app/page.tsx', 'r') as f:
        content = f.read()
    
    # Find and replace WEEKEND_FIXTURES
    import re
    
    # Pattern to match the WEEKEND_FIXTURES array
    pattern = r'const WEEKEND_FIXTURES = \[.*?\]'
    
    # Build new fixtures string
    new_fixtures = 'const WEEKEND_FIXTURES = [\n  '
    for i, f in enumerate(fixtures[:10]):
        comma = ',' if i < len(fixtures[:10]) - 1 else ''
        new_fixtures += f"{{ home: '{f['home']}', away: '{f['away']}', date: 'TBD', time: '{f['time']}' }}{comma}\n  "
    new_fixtures += ']'
    
    # Replace
    new_content = re.sub(pattern, new_fixtures, content, flags=re.DOTALL)
    
    with open('frontend/app/page.tsx', 'w') as f:
        f.write(new_content)
    
    print(f"Updated fixtures with {len(fixtures)} matches")

def main():
    print(f"Scraping fixtures at {datetime.now()}")
    fixtures = get_fixtures()
    
    if fixtures:
        update_fixtures_file(fixtures)
        print(f"Got {len(fixtures)} fixtures")
        
        # Save to JSON for the notification
        with open('fixtures_update.json', 'w') as f:
            json.dump({
                'fixtures': fixtures,
                'scraped_at': datetime.now().isoformat()
            }, f, indent=2)
    else:
        print("No fixtures found!")
        # Exit with error so GitHub Actions knows it failed
        exit(1)

if __name__ == "__main__":
    main()
