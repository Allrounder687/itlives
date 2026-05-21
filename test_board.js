const fs = require('fs');

async function test() {
    const url = "https://www.pinterest.com/pinterest/official-wallpapers/";
    console.log("Fetching board URL:", url);
    let text = "";
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        console.log("Status:", resp.status);
        text = await resp.text();
        fs.writeFileSync('board_raw.html', text, 'utf8');
        console.log("Body Length:", text.length);
    } catch (e) {
        console.error("Fetch failed", e);
        return;
    }

    // Try finding all href="/pin/(\d+)/" matches
    const pinRegex = /href="\/pin\/(\d+)\/?"/g;
    let match;
    const pinIds = new Set();
    while ((match = pinRegex.exec(text)) !== null) {
        pinIds.add(match[1]);
    }
    console.log("Unique pin IDs in href:", [...pinIds]);

    // Parse initialReduxState if present
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptRegex.exec(text)) !== null) {
        const content = scriptMatch[1].trim();
        if (content.includes('initialReduxState')) {
            console.log("Found initialReduxState script");
            // Find pins inside it
            const pinsMatch = content.match(/"pins"\s*:\s*\{([\s\S]*?)\}/);
            if (pinsMatch) {
                console.log("Pins section length:", pinsMatch[0].length);
            }
        }
    }
}
test();
