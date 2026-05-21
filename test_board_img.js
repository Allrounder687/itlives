const fs = require('fs');
const html = fs.readFileSync('board_raw.html', 'utf8');
const matches = html.match(/i\.pinimg\.com\/[^\s"'>]+/g) || [];
console.log("Found matches count:", matches.length);
console.log("Unique matches:", [...new Set(matches)].slice(0, 30));
