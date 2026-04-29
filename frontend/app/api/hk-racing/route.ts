import { NextResponse } from 'next/server';

const BASE_URL = 'https://www.racing-odds.com';

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
    next: { revalidate: 300 } // 5 min cache
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

const getRaceTimes = async (venue: string, date: string): Promise<string[]> => {
  // Race times are listed on the main HK racecards page, not the daily page
  const url = `${BASE_URL}/hong-kong-racecards`;
  const html = await fetchPage(url);
  
  const times: string[] = [];
  // Match: /daily/happy-valley/2026-04-29/12-40 or /daily/sha-tin/2026-04-29/14-10
  const regex = new RegExp(`/daily/${venue}/${date}/(\\d{2}-\\d{2})`, 'g');
  let match;
  while ((match = regex.exec(html)) !== null) {
    times.push(match[1]);
  }
  
  return Array.from(new Set(times)).sort();
};

// Convert UK time (GMT) to HK time (GMT+8)
const convertToHKTime = (ukTime: string): string => {
  const [hours, minutes] = ukTime.split(':').map(Number);
  let hkHour = hours + 8;
  // Handle next day (if +8 crosses midnight)
  if (hkHour >= 24) hkHour -= 24;
  return `${String(hkHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getRaceCard = async (date: string, venue: string, raceTime: string): Promise<Race | null> => {
  const url = `${BASE_URL}/daily/${venue}/${date}/${raceTime}`;
  const html = await fetchPage(url);
  
  if (!html.includes('horse-container')) {
    return null;
  }
  
  // Extract race name from h1
  const h1Match = /<h1[^>]*>([^<]+)<\/h1>/.exec(html);
  const raceName = h1Match ? h1Match[1] : 'Unknown Race';
  
  const horses = parseHorseContainer(html);
  
  return {
    time: convertToHKTime(raceTime.replace('-', ':')),
    race_name: raceName,
    horses
  };
};

export async function GET() {
  try {
    const date = getToday();
    const venues = ['happy-valley', 'sha-tin'];
    const results: Record<string, { venue: string; date: string; races: Race[] }> = {};
    
    for (const venue of venues) {
      const times = await getRaceTimes(venue, date);
      const races: Race[] = [];
      
      for (const time of times) {
        const race = await getRaceCard(date, venue, time);
        if (race && race.horses.length > 0) {
          races.push(race);
        }
      }
      
      if (races.length > 0) {
        results[venue] = {
          venue,
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
