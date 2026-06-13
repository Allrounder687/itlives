const fs = require('fs');

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const r = await fetch('https://alphacoders.com/live-wallpapers', { headers });
    const html = await r.text();
    fs.writeFileSync('scratch/live_wallpapers.html', html);
    console.log('Successfully wrote scratch/live_wallpapers.html');
    
    // Find form or input elements
    const searchForm = html.match(/<form[^>]*action="([^"]*)"[^>]*>([\s\S]*?)<\/form>/i);
    if (searchForm) {
      console.log('Found Form Action:', searchForm[1]);
      console.log('Form Content:', searchForm[2]);
    } else {
      console.log('No form found');
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
