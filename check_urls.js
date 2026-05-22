const fs = require('fs');
const content = fs.readFileSync('post.html', 'utf8');

const match = content.match(/<video[^>]*>([\s\S]*?)<\/video>/gi);
if (match) {
    console.log("Full video tag:");
    console.log(match[0]);
} else {
    console.log("No video tag found.");
}

// Find any download-button or class that contains the high-definition download link
const downloadButtons = content.match(/<a[^>]+class=["'][^"']*download[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
console.log("Download buttons found:", downloadButtons);

// Search for download.php link in any tag
const downloadPhp = content.match(/<a[^>]+href=["'][^"']*download\.php[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
console.log("Download PHP links found:", downloadPhp);
