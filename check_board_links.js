const fs = require('fs');
const html = fs.readFileSync('board_raw.html', 'utf8');

console.log("Contains 'pinimg':", html.includes("pinimg"));
console.log("Contains 'pin':", html.includes("pin"));
console.log("Contains 'https':", html.includes("https"));

const urls = html.match(/https?:\/\/[^\s"']+/g) || [];
console.log("Total http(s) urls in HTML:", urls.length);
console.log("Unique domains:", [...new Set(urls.map(u => {
    try {
        return new URL(u).hostname;
    } catch {
        return "invalid";
    }
}))]);
