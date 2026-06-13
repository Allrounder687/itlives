const fs = require('fs');

const html = fs.readFileSync('scratch/search_view_girl.html', 'utf8');

const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
let match;
const results = [];
while ((match = linkRegex.exec(html)) !== null) {
  const href = match[1];
  const text = match[2].replace(/<[^>]*>/g, '').trim();
  results.push({ href, text });
}

console.log('Total links extracted:', results.length);
console.log('Sample links with non-empty text:');
console.log(results.filter(r => r.text.length > 0 && (r.text.toLowerCase().includes('live') || r.text.toLowerCase().includes('wallpaper') || r.href.includes('live'))).slice(0, 50));
