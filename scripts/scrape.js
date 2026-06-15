const fs = require('fs');

const args = process.argv.slice(2);
const options = {};
args.forEach(arg => {
  const [key, value] = arg.split('=');
  if (key.startsWith('--')) {
    options[key.substring(2)] = value;
  }
});

const source = options.source;
const query = options.query || 'wallpaper';

if (!source) {
  console.error("Usage: node scripts/scrape.js --source=<pinterest|alphacoders> --query=\"your search term\"");
  process.exit(1);
}

const DESKTOP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MOBILE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

async function scrapePinterest(q) {
  console.log(`Scraping Pinterest for: ${q}`);
  const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;
  try {
    const resp = await fetch(url, { headers: MOBILE_HEADERS });
    const text = await resp.text();
    const pinimgMatches = text.match(/i\.pinimg\.com\/[^\s"'>]+/g) || [];
    const unique = [...new Set(pinimgMatches)];
    console.log(`Found ${unique.length} unique image URLs.`);
    if (unique.length > 0) {
      console.log('Sample:');
      console.log(unique.slice(0, 5));
    }
  } catch(e) {
    console.error("Pinterest Scrape Error:", e);
  }
}

async function scrapeAlphacoders(q) {
  console.log(`Scraping Alphacoders for: ${q}`);
  const url = 'https://alphacoders.com/live-wallpapers';
  try {
    const resp = await fetch(url, { headers: DESKTOP_HEADERS });
    const text = await resp.text();
    const searchForm = text.match(/<form[^>]*action="([^"]*)"[^>]*>([\s\S]*?)<\/form>/i);
    if (searchForm) {
      console.log('Found Search Form Action:', searchForm[1]);
    } else {
      console.log('No form found on alphacoders.');
    }
  } catch(e) {
    console.error("Alphacoders Scrape Error:", e);
  }
}

async function run() {
  if (source === 'pinterest') {
    await scrapePinterest(query);
  } else if (source === 'alphacoders') {
    await scrapeAlphacoders(query);
  } else {
    console.error(`Unknown source: ${source}. Supported: pinterest, alphacoders`);
  }
}

run();
