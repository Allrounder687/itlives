const https = require('https');

const tests = [
  {
    thumb: 'https://wallpaperwaves.com/wp-content/uploads/2026/05/dreamy-hydrangea-bloom-wallpaperwaves-com.webp',
    post: 'https://wallpaperwaves.com/landscape/dreamy-hydrangea-bloom-live-wallpaper/'
  },
  {
    thumb: 'https://wallpaperwaves.com/wp-content/uploads/2026/05/guts-berserker-rage-armor-wallpaperwaves-com.webp',
    post: 'https://wallpaperwaves.com/anime/guts-berserker-rage-armor-live-wallpaper/'
  },
  {
    thumb: 'https://wallpaperwaves.com/wp-content/uploads/2026/05/forbidden-eye-symbol-wallpaperwaves-com.webp',
    post: 'https://wallpaperwaves.com/fantasy/forbidden-eye-symbol-live-wallpaper/'
  }
];

function checkUrl(url, callback) {
  https.request(url, { method: 'HEAD' }, (res) => {
    callback(res.statusCode === 200);
  }).on('error', () => {
    callback(false);
  }).end();
}

let index = 0;
function runNext() {
  if (index >= tests.length) return;
  const test = tests[index];
  
  // Try predicting preview
  const predictedPreview = test.thumb.replace('-wallpaperwaves-com.webp', '-preview.mp4');
  console.log(`Testing predicted preview for: ${test.post}`);
  console.log(`URL: ${predictedPreview}`);
  
  checkUrl(predictedPreview, (exists) => {
    console.log(`Exists: ${exists}`);
    index++;
    runNext();
  });
}

runNext();
