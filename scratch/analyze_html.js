const fs = require('fs');

const html = fs.readFileSync('scratch/live_wallpapers.html', 'utf8');

// Find any links containing search or live-wallpaper or anything relevant
const links = html.match(/href="([^"]*)"/g) || [];
console.log('Total links:', links.length);
const searchLinks = links.filter(l => l.includes('search') || l.includes('live-wallpaper'));
console.log('Search-related links (first 20):', searchLinks.slice(0, 20));

// Find any option or select tags
const options = html.match(/<option[^>]*>([\s\S]*?)<\/option>/gi) || [];
console.log('Total options:', options.length);
if (options.length > 0) {
  console.log('Options:', options);
}
