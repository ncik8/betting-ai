"""
HK Horse Racing scraper using racing-odds.com
"""
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re
import json

BASE_URL = "https://www.racing-odds.com"

def get_todays_races(venue: str = None) -> dict:
    """
    Get all HK races for today.
    venue: 'happy-valley' or 'sha-tin' or None for both
    """
    today = datetime.now().strftime("%Y-%m-%d")
    results = {}
    
    venues = ['happy-valley', 'sha-tin'] if venue is None else [venue]
    
    for v in venues:
        url = f"{BASE_URL}/daily/{v}/{today}"
        try:
            resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
            if resp.status_code != 200:
                continue
                
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # Find all race times on the page
            race_times = []
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                if f'/daily/{v}/{today}/' in href:
                    match = re.search(r'/(\d{2}-\d{2})$', href)
                    if match:
                        race_times.append(match.group(1))
            
            race_times = list(set(race_times))  # Remove duplicates
            race_times.sort()
            
            races = []
            for time_str in race_times:
                race = get_race_card(today, v, time_str)
                if race and race.get('horses'):
                    races.append(race)
            
            if races:
                results[v.replace('-', ' ').title()] = {
                    'venue': v,
                    'date': today,
                    'races': races
                }
                
        except Exception as e:
            print(f"Error fetching {v}: {e}")
    
    return results


def get_race_card(date: str, venue: str, race_time: str) -> dict:
    """
    Get race card for a specific race.
    date: YYYY-MM-DD
    venue: 'happy-valley' or 'sha-tin'
    race_time: HH-MM (e.g., 11-40)
    """
    url = f"{BASE_URL}/daily/{venue}/{date}/{race_time}"
    
    try:
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code != 200:
            return None
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        race_info = {
            'time': race_time.replace('-', ':'),
            'race_name': '',
            'horses': []
        }
        
        # Get race title from h1
        h1 = soup.find('h1')
        if h1:
            race_info['race_name'] = h1.get_text(strip=True)
        
        # Parse horses
        containers = soup.find_all('div', class_='horse-container')
        
        for c in containers:
            horse = {}
            
            # Name
            name = c.find('span', class_='css-z5vkvz')
            if name:
                horse['name'] = name.get_text(strip=True)
            
            # Draw
            draw = c.find('div', class_='css-horse-small')
            if draw:
                horse['draw'] = draw.get_text(strip=True)
            
            # Odds (first occurrence)
            odds = c.find('span', class_='oddsLink')
            if odds:
                horse['odds'] = odds.get_text(strip=True)
            
            # Key-value pairs
            for div in c.find_all('div', class_='css-wenkbk'):
                spans = div.find_all('span')
                if len(spans) >= 2:
                    label = spans[0].get_text(strip=True)
                    value = spans[1].get_text(strip=True)
                    if label == 'J:':
                        horse['jockey'] = value
                    elif label == 'T:':
                        horse['trainer'] = value
                    elif label == 'Age:':
                        horse['age'] = value
                    elif label == 'Weight:':
                        horse['weight'] = value
                    elif label == 'Form:':
                        horse['form'] = value
                    elif label == 'Draw:':
                        horse['draw'] = value
            
            if horse.get('name'):
                race_info['horses'].append(horse)
        
        return race_info
        
    except Exception as e:
        print(f"Error getting race card: {e}")
        return None


def format_for_ai(data: dict) -> str:
    """Format HK racing data for the AI chat context."""
    if not data:
        return "No HK racing data available today."
    
    output = "🏇 HK Horse Racing - Today's Races\n\n"
    
    for venue_name, venue_data in data.items():
        output += f"📍 {venue_name}\n"
        output += "-" * 40 + "\n"
        
        for race in venue_data.get('races', []):
            output += f"\n⏰ {race.get('time', '??:??')} - {race.get('race_name', 'Unknown Race')}\n"
            output += f"Runners: {len(race.get('horses', []))}\n"
            
            # Sort by draw number
            horses = sorted(race.get('horses', []), key=lambda x: int(x.get('draw', 0)) if x.get('draw', '').isdigit() else 999)
            
            for h in horses:
                odds = h.get('odds', 'N/A')
                form = h.get('form', 'N/A')
                jockey = h.get('jockey', 'N/A')
                trainer = h.get('trainer', 'N/A')
                weight = h.get('weight', 'N/A')
                output += f"  #{h.get('draw', '?')} {h.get('name', 'Unknown')}\n"
                output += f"      Odds: {odds} | Form: {form} | Wgt: {weight}\n"
                output += f"      Jockey: {jockey} | Trainer: {trainer}\n"
        
        output += "\n"
    
    return output


if __name__ == "__main__":
    print("=== HK Horse Racing Scraper ===\n")
    
    data = get_todays_races()
    print(format_for_ai(data))
