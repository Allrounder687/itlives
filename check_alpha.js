const https = require('https');
https.get('https://alphacoders.com/live-wallpapers?page=1', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const matches = d.match(/https:\/\/[^\s"'<>]*(1408575)[^\s"'<>]*/g);
        console.log("Matches for 1408575:");
        console.log(matches ? [...new Set(matches)].join('\n') : 'no match');
    });
});
