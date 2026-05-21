const fs = require('fs');

const html = fs.readFileSync('pinterest_fetched.html', 'utf8');

// Find all script tags
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content.includes('initialReduxState') || content.startsWith('{"otaData"') || content.includes('reduxState')) {
        console.log(`Found candidate script with length ${content.length}`);
        // Save the first candidate script to parse it or analyze it
        fs.writeFileSync(`script_${count}.js`, content, 'utf8');
        count++;
    }
}
console.log(`Total candidate scripts: ${count}`);
