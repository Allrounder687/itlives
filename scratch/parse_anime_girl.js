const fs = require('fs');

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const url = 'https://alphacoders.com/anime-girl';
    const r = await fetch(url, { headers });
    const html = await r.text();
    fs.writeFileSync('scratch/anime_girl.html', html);
    
    // Find all links containing big.php?i=
    const bigLinks = html.match(/href="[^"]*big\.php\?i=(\d+)"/g) || [];
    console.log('Total big.php?i= links:', bigLinks.length);
    console.log('Sample big.php?i= links:', bigLinks.slice(0, 10));
    
    // Search for mp4 files
    const mp4Matches = html.match(/https:\/\/(images\d*\.alphacoders\.com\/\d+\/)(\d+)\.mp4/g) || [];
    console.log('MP4 Matches on anime-girl tag page:', mp4Matches.length);
  } catch (e) {
    console.error(e);
  }
}

test();
