const fs = require('fs');

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const url = 'https://alphacoders.com/search/view?q=girl&type=live-wallpapers';
    console.log('Fetching', url);
    const r = await fetch(url, { headers });
    console.log('Status:', r.status);
    const html = await r.text();
    fs.writeFileSync('scratch/search_results.html', html);
    
    const mp4Matches = html.match(/https:\/\/(images\d*\.alphacoders\.com\/\d+\/)(\d+)\.mp4/g) || [];
    console.log('Found MP4 matches:', mp4Matches.length);
    if (mp4Matches.length > 0) {
      console.log('First 3 matches:', mp4Matches.slice(0, 3));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
