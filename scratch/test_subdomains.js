async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const urls = [
      'https://live-wallpapers.alphacoders.com/',
      'https://live-wallpaper.alphacoders.com/',
      'https://video.alphacoders.com/',
      'https://mobile.alphacoders.com/live-wallpapers'
    ];
    for (const url of urls) {
      const r = await fetch(url, { headers });
      console.log('URL:', url, 'Status:', r.status);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
