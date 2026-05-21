const fs = require('fs');
const html = fs.readFileSync('pinterest_fetched.html', 'utf8');
console.log("First 1000 chars:");
console.log(html.substring(0, 1000));

const keywords = ["login", "signup", "captcha", "robot", "auth", "redirect", "sign-up", "sign-in"];
for (let kw of keywords) {
    const count = (html.match(new RegExp(kw, 'gi')) || []).length;
    console.log(`Keyword "${kw}": ${count} matches`);
}
