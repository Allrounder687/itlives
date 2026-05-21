const fs = require('fs');

const html = fs.readFileSync('pinterest_spec.html', 'utf8');

// Find all script tags
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
        console.log(`Script #${++count}: Length ${content.length}`);
        if (content.includes('pins') || content.includes('pinimg') || content.includes('options')) {
            console.log(`  --> Contains keywords! Snippet: ${content.substring(0, 300)}...`);
        }
    }
}
