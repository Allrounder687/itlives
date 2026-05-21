const fs = require('fs');

async function test() {
    const url = "https://www.pinterest.com/pinterest/official-wallpapers/";
    console.log("Fetching board URL with desktop User-Agent:", url);
    let text = "";
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
            }
        });
        console.log("Status:", resp.status);
        text = await resp.text();
        fs.writeFileSync('board_desktop.html', text, 'utf8');
        console.log("Body Length:", text.length);
    } catch (e) {
        console.error("Fetch failed", e);
        return;
    }

    const matches = text.match(/i\.pinimg\.com\/[^\s"'>]+/g) || [];
    console.log("Found matches count:", matches.length);
    console.log("Unique matches:", [...new Set(matches)].slice(0, 30));

    // Try finding all href="/pin/(\d+)/" matches
    const pinRegex = /href="\/pin\/(\d+)\/?"/g;
    let match;
    const pinIds = new Set();
    while ((match = pinRegex.exec(text)) !== null) {
        pinIds.add(match[1]);
    }
    console.log("Unique pin IDs in href:", [...pinIds]);
}
test();
