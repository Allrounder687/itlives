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
        console.log("Status:", resp.status);
        text = await resp.text();
        console.log("Body Length:", text.length);
    } catch (e) {
        console.error("Fetch failed", e);
        return;
    }

    // Try finding all href="/pin/(\d+)/" matches and their next pinimg matches
    // A pin block is usually like: <a href="/pin/12345/"> ... <img src="...pinimg.com/236x/ab/cd/ef/abcdef.jpg"> ... </a>
    // We can use a regex that matches href="/pin/(\d+)/" and then search for the first pinimg URL that follows it before the next href="/pin/
    const pinRegex = /href="\/pin\/(\d+)\/?"/g;
    let match;
    const pins = [];
    const seenPins = new Set();

    // Let's find all indexes of pin links
    const indices = [];
    while ((match = pinRegex.exec(text)) !== null) {
        indices.push({ id: match[1], index: match.index });
    }

    console.log("Found pin link matches:", indices.length);

    for (let i = 0; i < indices.length; i++) {
        const current = indices[i];
        const nextIndex = (i + 1 < indices.length) ? indices[i + 1].index : text.length;
        const segment = text.substring(current.index, nextIndex);
        
        // Find the first pinimg match in this segment
        const imgMatch = segment.match(/i\.pinimg\.com\/([^\s"'>]+)/);
        if (imgMatch) {
            const imgPath = imgMatch[1];
            // Normalize size in path to originals
            // imgPath is e.g. "236x/ab/cd/ef/abcdef.jpg"
            const sizeMatch = imgPath.match(/^(236x|474x|736x|originals|170x)\/([a-f0-9/]+\.[a-z0-9]+)/i);
            if (sizeMatch) {
                const cleanPath = sizeMatch[2];
                if (!seenPins.has(current.id)) {
                    seenPins.add(current.id);
                    pins.push({
                        id: current.id,
                        image: `https://i.pinimg.com/originals/${cleanPath}`,
                        thumbnail: `https://i.pinimg.com/236x/${cleanPath}`
                    });
                }
            }
        }
    }

    console.log("Total pins parsed:", pins.length);
    console.log("First 15 pins parsed:");
    console.log(pins.slice(0, 15));
}

test();
