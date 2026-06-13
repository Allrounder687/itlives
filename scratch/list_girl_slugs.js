const fs = require('fs');

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const url = 'https://motionbgs.com/tag:girl/';
    const r = await fetch(url, { headers });
    const text = await r.text();
    
    // Extract slugs
    const items = [];
    let cursor = 0;
    while (true) {
      const idx = text.indexOf('546x308/media/', cursor);
      if (idx === -1) break;
      const start = idx + 14;
      const remaining = text.substring(start);
      const slash = remaining.indexOf('/');
      if (slash !== -1) {
        const remaining2 = remaining.substring(slash + 1);
        const quote = remaining2.search(/["'\s\/]/);
        if (quote !== -1) {
          const slug = remaining2.substring(0, quote);
          if (slug && slug !== 'thumb' && slug !== 'thumb.jpg') {
            items.push(slug);
          }
        }
      }
      cursor = start + 1;
    }
    const uniqueSlugs = [...new Set(items)];
    console.log('Total unique slugs:', uniqueSlugs.length);
    console.log('Slugs found:');
    console.log(uniqueSlugs);
  } catch (e) {
    console.error(e);
  }
}

test();
