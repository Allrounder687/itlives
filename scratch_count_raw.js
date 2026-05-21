const fs = require('fs');

if (fs.existsSync('pinterest_raw.html')) {
    const html = fs.readFileSync('pinterest_raw.html', 'utf8');
    const matches = html.match(/https?:\/\/[a-zA-Z0-9.-]*(pinimg|pinterest)\.com[a-zA-Z0-9_./%-]*/g) || [];
    console.log("Total matches in pinterest_raw.html:", matches.length);
    const images = matches.filter(m => m.match(/\.(jpg|png|webp)/i));
    console.log("Unique image matches in pinterest_raw.html:", [...new Set(images)].length);
} else {
    console.log("pinterest_raw.html not found");
}
