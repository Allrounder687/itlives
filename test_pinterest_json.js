const fs = require('fs');

const html = fs.readFileSync('pinterest_spec.html', 'utf8');

const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content.startsWith('{"otaData"') || content.includes('initialReduxState')) {
        console.log(`Found candidate script with length ${content.length}`);
        // Let's find any URLs matching pinimg in this text
        const pinimgRegex = /https:\\\/\\\/i\.pinimg\.com\\\/[^"]+/g;
        const matches = content.match(pinimgRegex) || [];
        console.log(`Found ${matches.length} pinimg matches in this script:`);
        const cleanMatches = [...new Set(matches.map(m => m.replace(/\\/g, '')))];
        console.log(`Unique urls:`, cleanMatches.slice(0, 10));
    }
}
