const fs = require('fs');

const html = fs.readFileSync('scratch/live_wallpapers.html', 'utf8');
const links = html.match(/href="([^"]*)"/g) || [];
const uniqueLinks = [...new Set(links)];

console.log('First 50 unique links:');
console.log(uniqueLinks.slice(0, 50));
