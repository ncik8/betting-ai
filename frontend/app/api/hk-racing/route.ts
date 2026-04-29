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

interface RaceInfo {
  raceNo: number;
  actualTime: string;  // HKJC real time
  oddsSlug: string;    // racing-odds.com URL slug
}

const fetchPage = async (url: string) => {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    next: { revalidate: 60 }
  });
  return resp.text();
};

const parseHorseContainer = (html: string): Horse[] => {
  const horses: Horse[] = [];
  
  const containerRegex = /<div[^>]*class="[^"]*horse-container[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
  let match;
  
  while ((match = containerRegex.exec(html)) !== null) {
    const block = match[0];
    const horse: Partial<Horse> = {};
    
    const numberMatch = /class="css-horse-small[^"]*"[^>]*>(\d+)</.exec(block);
    if (numberMatch) horse.draw = numberMatch[1];
    
    const nameMatch = /class="css-z5vkvz"[^>]*>([^<]+)<\/span>/.exec(block);
    if (nameMatch) horse.name = nameMatch[1];
    
    const oddsMatch = /class="oddsLink[^"]*"[^>]*>([\d.]+)<\/span>/.exec(block);
    if (oddsMatch) horse.odds = oddsMatch[1];
    
    const jockeyMatch = /<span>J:<\/span><span class="text-bold">([^<]+)<\/span>/.exec(block);
    if (jockeyMatch) horse.jockey = jockeyMatch[1];
    
    const trainerMatch = /<span>T:<\/span><span class="text-bold">([^<]+)<\/span>/.exec(block);
    if (trainerMatch) horse.trainer = trainerMatch[1];
    
    const ageMatch = /<span>Age:<\/span><span class="text-bold">(\d+)<\/span>/.exec(block);
    if (ageMatch) horse.age = ageMatch[1];
    
    const weightMatch = /<span>Weight:<\/span><span class="text-bold">([^<]+)<\/span>/.exec(block);
    if (weightMatch) horse.weight = weightMatch[1];
    
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

// Get actual race times from HKJC and discover the racing-odds.com slug mapping
const getRaceInfo = async (venue: string): Promise<RaceInfo[]> => {
  const hkjcVenue = venue === 'happy-valley' ? 'HV' : 'ST';
  const races: RaceInfo[] = [];
  
  // Fetch the racing-odds.com listing page to get the time slugs
  const listingUrl = `${ODDS_BASE_URL}/hong-kong-racecards`;
  const listingHtml = await fetchPage(listingUrl);
  
  // Extract all HK race URLs and their time slugs
  // e.g., /daily/happy-valley/2026-04-29/13-10
  const slugRegex = new RegExp(`/daily/${venue}/(\\d{4}-\\d{2}-\\d{2})/(\\d{2}-\\d{2})`, 'g');
  const slugMap: Record<string, string> = {};
  let match;
  while ((match = slugRegex.exec(listingHtml)) !== null) {
    const slug = match[2]; // e.g., "13-10"
    slugMap[slug] = slug;
  }
  
  // Now check each HKJC race to get actual times and match to slugs
  for (let raceNo = 1; raceNo <= 12; raceNo++) {
    try {
      const date = getToday().replace(/-/g, '/');
      const hkjcUrl = `${HKJC_BASE_URL}/racecard?racedate=${date}&Racecourse=${hkjcVenue}&RaceNo=${raceNo}`;
      const hkjcHtml = await fetchPage(hkjcUrl);
      
      // Extract 24hr time like "18:40"
      const timeMatch = /(\d{2}):(\d{2})/.exec(hkjcHtml);
      if (!timeMatch) break;
      
      const actualTime = `${timeMatch[1]}:${timeMatch[2]}`;
      
      // Find the corresponding racing-odds slug by trying all available slugs
      // and matching horse names (we use raceNo as index into sorted slugs)
      const sortedSlugs = Object.keys(slugMap).sort();
      const slugIndex = raceNo - 1;
      
      if (slugIndex < sortedSlugs.length) {
        races.push({
          raceNo,
          actualTime,
          oddsSlug: sortedSlugs[slugIndex]
        });
      }
    } catch {
      break;
    }
  }
  
  return races;
};

const getRaceCard = async (
  date: string, 
  oddsVenue: string, 
  raceInfo: RaceInfo
): Promise<Race | null> => {
  // racing-odds.com uses time-based slugs like /13-10, /14-10
  const url = `${ODDS_BASE_URL}/daily/${oddsVenue}/${date}/${raceInfo.oddsSlug}`;
  const html = await fetchPage(url);
  
  if (!html.includes('horse-container')) {
    return null;
  }
  
  const h1Match = /<h1[^>]*>([^<]+)<\/h1>/.exec(html);
  const raceName = h1Match ? h1Match[1] : `Race ${raceInfo.raceNo}`;
  
  const horses = parseHorseContainer(html);
  
  return {
    time: raceInfo.actualTime, // Show correct HKJC time
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
      // Get race info (HKJC times + racing-odds slugs)
      const raceInfos = await getRaceInfo(venue);
      
      if (raceInfos.length === 0) {
        continue;
      }
      
      const races: Race[] = [];
      
      for (const raceInfo of raceInfos) {
        const race = await getRaceCard(date, venue, raceInfo);
        if (race && race.horses.length > 0) {
          races.push(race);
        }
      }
      
      if (races.length > 0) {
        results[venue] = { venue, date, races };
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
