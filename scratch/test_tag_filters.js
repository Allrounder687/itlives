async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const urls = [
    'https://alphacoders.com/cyberpunk?type=live-wallpapers',
    'https://alphacoders.com/cyberpunk?search_type=live-wallpapers',
    'https://alphacoders.com/cyberpunk/live-wallpapers',
    'https://alphacoders.com/live-wallpapers/by-tag/cyberpunk',
    'https://alphacoders.com/by-type/live-wallpapers/tag/cyberpunk'
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers });
      const html = await r.text();
      const mp4Matches = html.match(/https:\/\/(images\d*\.alphacoders\.com\/\d+\/)(\d+)\.mp4/g) || [];
      console.log(`URL: ${url} | Status: ${r.status} | MP4 Matches: ${mp4Matches.length}`);
    } catch (e) {
      console.error(e);
    }
  }
}

test();
