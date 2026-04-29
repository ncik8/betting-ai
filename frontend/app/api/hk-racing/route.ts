import { NextResponse } from 'next/server';

const ODDS_BASE_URL = 'https://www.racing-odds.com';
const HKJC_BASE_URL = 'https://racing.hkjc.com/en-us/local/information';

interface Horse {
  name: string;
  draw: string;
  odds: string;
  jockey?: string;
  trainer?: string;
  age?: string;
  weight?: string;
  form?: string;
}

interface Race {
  time: string;
  race_name: string;
  horses: Horse[];
}

const fetchPage = async (url: string) => {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    next: { revalidate: 60 } // 1 min cache
  });
  return resp.text();
};

const parseHorseContainer = (html: string): Horse[] => {
  const horses: Horse[] = [];
  
  // Match horse-container blocks with new HTML structure
  const containerRegex = /<div[^>]*class="[^"]*horse-container[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
  let match;
  
  while ((match = containerRegex.exec(html)) !== null) {
    const block = match[0];
    const horse: Partial<Horse> = {};
    
    // Horse number (draw) - <div class="css-horse-small css-horse2">9</div>
    const numberMatch = /class="css-horse-small[^"]*"[^>]*>(\d+)</.exec(block);
    if (numberMatch) horse.draw = numberMatch[1];
    
    // Horse name - <span font-weight="700" class="css-z5vkvz">Star Brose</span>
    const nameMatch = /class="css-z5vkvz"[^>]*>([^<]+)<\/span>/.exec(block);
    if (nameMatch) horse.name = nameMatch[1];
    
    // Odds - <span class="oddsLink js-btn-modal" data-id="starbrose">2.10</span>
    const oddsMatch = /class="oddsLink[^"]*"[^>]*>([\d.]+)<\/span>/.exec(block);
    if (oddsMatch) horse.odds = oddsMatch[1];
    
    // Jockey - <span>J:</span><span class="text-bold">Zac Purton</span>
    const jockeyMatch = /<span>J:<\/span><span class="text-bold">([^<]+)<\/span>/.exec(block);
    if (jockeyMatch) horse.jockey = jockeyMatch[1];
    
    // Trainer - <span>T:</span><span class="text-bold">D A Hayes</span>
    const trainerMatch = /<span>T:<\/span><span class="text-bold">([^<]+)<\/span>/.exec(block);
    if (trainerMatch) horse.trainer = trainerMatch[1];
    
    // Age - <span>Age:</span><span class="text-bold">5</span>
    const ageMatch = /<span>Age:<\/span><span class="text-bold">(\d+)<\/span>/.exec(block);
    if (ageMatch) horse.age = ageMatch[1];
    
    // Weight - <span>Weight:</span><span class="text-bold">8-10</span>
    const weightMatch = /<span>Weight:<\/span><span class="text-bold">([^<]+)<\/span>/.exec(block);
    if (weightMatch) horse.weight = weightMatch[1];
    
    // Form - <span>Form:</span><span class="text-bold">8643519523</span>
    const formMatch = /<span>Form:<\/span><span class="text-bold">([^<]+)<\/span>/.exec(block);
    if (formMatch) horse.form = formMatch[1];
    
    if (horse.name) horses.push(horse as Horse);
  }
  
  return horses;
};

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Get actual race times from HKJC website
const getRaceTimesFromHKJC = async (venue: string): Promise<Record<number, string>> => {
  // venue: 'HV' or 'ST'
  const raceTimes: Record<number, string> = {};
  
  // Try races 1-12 (HK races rarely go above 12)
  for (let raceNo = 1; raceNo <= 12; raceNo++) {
    try {
      const date = getToday().replace(/-/g, '/');
      const url = `${HKJC_BASE_URL}/racecard?racedate=${date}&Racecourse=${venue}&RaceNo=${raceNo}`;
      const html = await fetchPage(url);
      
      // Extract time from HKJC page - look for 24hr format like "18:40"
      const timeMatch = /(\d{2}):(\d{2})/.exec(html);
      if (timeMatch) {
        raceTimes[raceNo] = `${timeMatch[1]}:${timeMatch[2]}`;
      } else {
        // No more races found, stop searching
        break;
      }
    } catch {
      break;
    }
  }
  
  return raceTimes;
};

// Map HKJC venue code to racing-odds.com format
const hkjcToOddsVenue = (hkjcVenue: string): string => {
  const map: Record<string, string> = {
    'HV': 'happy-valley',
    'ST': 'sha-tin'
  };
  return map[hkjcVenue] || hkjcVenue.toLowerCase();
};

// Get race card from racing-odds.com and use actual HKJC time
const getRaceCard = async (
  date: string, 
  oddsVenue: string, 
  raceNo: number, 
  actualTime: string
): Promise<Race | null> => {
  // racing-odds.com uses format like /daily/happy-valley/2026-04-29/13-10
  const url = `${ODDS_BASE_URL}/daily/${oddsVenue}/${date}/${raceNo}`;
  const html = await fetchPage(url);
  
  if (!html.includes('horse-container')) {
    return null;
  }
  
  // Extract race name from h1
  const h1Match = /<h1[^>]*>([^<]+)<\/h1>/.exec(html);
  const raceName = h1Match ? h1Match[1] : `Race ${raceNo}`;
  
  const horses = parseHorseContainer(html);
  
  return {
    time: actualTime, // Use actual HKJC time
    race_name: raceName,
    horses
  };
};

export async function GET() {
  try {
    const date = getToday();
    const hkjcVenues = ['HV', 'ST'];
    const results: Record<string, { venue: string; date: string; races: Race[] }> = {};
    
    for (const hkjcVenue of hkjcVenues) {
      const oddsVenue = hkjcToOddsVenue(hkjcVenue);
      
      // Get actual race times from HKJC
      const raceTimes = await getRaceTimesFromHKJC(hkjcVenue);
      
      if (Object.keys(raceTimes).length === 0) {
        continue; // No races today at this venue
      }
      
      const races: Race[] = [];
      
      for (const [raceNoStr, actualTime] of Object.entries(raceTimes)) {
        const raceNo = parseInt(raceNoStr);
        const race = await getRaceCard(date, oddsVenue, raceNo, actualTime);
        if (race && race.horses.length > 0) {
          races.push(race);
        }
      }
      
      if (races.length > 0) {
        results[oddsVenue] = {
          venue: oddsVenue,
          date,
          races
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      data: results,
      cached: false
    });
    
  } catch (error) {
    console.error('HK Racing API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch HK racing data' },
      { status: 500 }
    );
  }
}
