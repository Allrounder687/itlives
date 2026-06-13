const fs = require('fs');

const html = fs.readFileSync('scratch/live_wallpapers.html', 'utf8');

// Find all links containing tag, category, subcategory, or other terms
const links = html.match(/href="([^"]*)"/g) || [];
const uniqueLinks = [...new Set(links)];

console.log('Total unique links:', uniqueLinks.length);
console.log('Categories or tags (first 50):');
console.log(uniqueLinks.filter(l => l.includes('by-') || l.includes('tag') || l.includes('category') || l.includes('sub-') || l.includes('live-wallpapers/')).slice(0, 50));
