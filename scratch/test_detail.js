async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const url = 'https://wall.alphacoders.com/big.php?i=1403028';
    console.log('Fetching', url);
    const r = await fetch(url, { headers });
    const html = await r.text();
    const mp4Matches = html.match(/https:\/\/[\w\.]*?\.alphacoders\.com\/[\s\S]*?\.mp4/gi) || [];
    console.log('MP4 Matches:', mp4Matches);
  } catch (e) {
    console.error(e);
  }
}

test();
