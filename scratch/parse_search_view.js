const fs = require('fs');

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const url = 'https://alphacoders.com/search/view?q=girl';
    console.log('Fetching', url);
    const r = await fetch(url, { headers });
    const html = await r.text();
    fs.writeFileSync('scratch/search_view_girl.html', html);
    
    // Find all links
    const links = html.match(/href="([^"]*)"/g) || [];
    const uniqueLinks = [...new Set(links)];
    console.log('Total unique links:', uniqueLinks.length);
    
    // Filter links containing "live-wallpaper" or "type=" or ".mp4"
    const matchedLinks = uniqueLinks.filter(l => l.includes('live-') || l.includes('mp4') || l.includes('type=') || l.includes('video'));
    console.log('Matched links:', matchedLinks);
  } catch (e) {
    console.error(e);
  }
}

test();
