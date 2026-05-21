const fs = require('fs');

async function test() {
    const url = "https://www.pinterest.com/search/pins/?q=fantasy%20wallpaper";
    let text = "";
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        text = await resp.text();
    } catch (e) {
        console.error(e);
        return;
    }

    // Let's find all instances of i.pinimg.com and print their context
    // We want to see if they are in JSON strings, or HTML tags, and if there are pin IDs nearby!
    const re = /i\.pinimg\.com\/[^\s"'>]+/g;
    const matches = [...new Set(text.match(re) || [])];
    console.log("Total unique pinimg urls found:", matches.length);

    for (let m of matches) {
        if (m.includes("df/6b/a1") || m.includes("df6ba17f")) {
            console.log("Found match for df6ba17f!");
            const idx = text.indexOf(m);
            console.log("Context:");
            console.log(text.substring(Math.max(0, idx - 300), Math.min(text.length, idx + 300)));
            break;
        }
    }
}
test();
