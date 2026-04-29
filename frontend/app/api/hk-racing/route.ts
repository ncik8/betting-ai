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
  
  // Extract horse-container blocks
  const containerRegex = /<div class="horse-container"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
  let match;
  
  while ((match = containerRegex.exec(html)) !== null) {
    const block = match[1];
    const horse: Horse = {};
    
    // Name
    const nameMatch = /<span class="css-z5vkvz"[^>]*>([^<]+)<\/span>/.exec(block);
    if (nameMatch) horse.name = nameMatch[1];
    
    // Draw
    const drawMatch = /<div class="css-horse-small[^"]*"[^>]*>(\d+)<\/div>/.exec(block);
    if (drawMatch) horse.draw = drawMatch[1];
    
    // Odds
    const oddsMatch = /<span class="oddsLink[^"]*"[^>]*>([\d.]+)<\/span>/.exec(block);
    if (oddsMatch) horse.odds = oddsMatch[1];
    
    // Key-value pairs
    const kvRegex = /<span>(J:|T:|Age:|Weight:|Form:|Draw:)<\/span><span class="text-bold">([^<]+)<\/span>/g;
    let kvMatch;
    while ((kvMatch = kvRegex.exec(block)) !== null) {
      const [, label, value] = kvMatch;
      if (label === 'J:') horse.jockey = value;
      else if (label === 'T:') horse.trainer = value;
      else if (label === 'Age:') horse.age = value;
      else if (label === 'Weight:') horse.weight = value;
      else if (label === 'Form:') horse.form = value;
      else if (label === 'Draw:') horse.draw = value;
    }
    
    if (horse.name) horses.push(horse);
  }
  
  return horses;
};

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getRaceTimes = async (venue: string, date: string): Promise<string[]> => {
  const url = `${BASE_URL}/daily/${venue}/${date}`;
  const html = await fetchPage(url);
  
  const times: string[] = [];
  const regex = new RegExp(`/daily/${venue}/${date}/(\\d{2}-\\d{2})`, 'g');
  let match;
  while ((match = regex.exec(html)) !== null) {
    times.push(match[1]);
  }
  
  return [...new Set(times)].sort();
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
    time: raceTime.replace('-', ':'),
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
