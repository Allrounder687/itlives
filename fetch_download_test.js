const https = require('https');

const url = 'https://wallpaperwaves.com/download.php?video=public_html/25/goku-black-rose-aura-wallpaperwaves-com.mp4';

const options = {
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://wallpaperwaves.com/anime/goku-black-rose-aura-live-wallpaper/'
  }
};

https.get(url, options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let receivedBytes = 0;
  res.on('data', (chunk) => {
    receivedBytes += chunk.length;
    if (receivedBytes > 100000) {
      console.log('Successfully received over 100KB, destroying stream.');
      res.destroy();
    }
  });

  res.on('close', () => {
    console.log('Received total bytes:', receivedBytes);
  });
}).on('error', (err) => {
  console.error('Error fetching download link:', err);
});
