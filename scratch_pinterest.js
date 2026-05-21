const fs = require('fs');

if (fs.existsSync('pinterest_fetched.html')) {
    const html = fs.readFileSync('pinterest_fetched.html', 'utf8');
    const matches = html.match(/https?:\/\/[a-zA-Z0-9.-]*(pinimg|pinterest)\.com[a-zA-Z0-9_./%-]*/g) || [];
    const gifs = matches.filter(m => m.match(/\.gif/i));
    console.log("Unique GIF matches:", [...new Set(gifs)]);
} else {
    console.log("pinterest_fetched.html not found");
}
