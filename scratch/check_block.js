const fs = require('fs');

const html = fs.readFileSync('scratch/search_view_girl.html', 'utf8');

console.log('HTML Length:', html.length);
if (html.includes('Cloudflare') || html.includes('captcha') || html.includes('Verify you are human')) {
  console.log('Blocked by Cloudflare/Captcha!');
} else {
  // Print some page headers or navigation links
  const nav = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
  if (nav) {
    console.log('Nav HTML:', nav[1]);
  } else {
    // Print lines containing "href"
    const lines = html.split('\n');
    console.log('Matching lines:');
    const matched = lines.filter(l => l.includes('href="/') || l.includes('href="http')).slice(0, 30);
    console.log(matched);
  }
}
