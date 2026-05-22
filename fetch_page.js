const https = require('https');
const fs = require('fs');

const url = 'https://wallpaperwaves.com/anime/goku-black-rose-aura-live-wallpaper/';

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
  }
};

https.get(url, options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Fetched data length:', data.length);
    fs.writeFileSync('post.html', data);
    console.log('Saved to post.html');
  });
}).on('error', (err) => {
  console.error('Error fetching page:', err);
});
