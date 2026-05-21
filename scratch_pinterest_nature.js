const fs = require('fs');

async function checkUrl(name, url) {
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        const text = await resp.text();
        fs.writeFileSync(`${name}.html`, text, 'utf8');
        console.log(`Saved ${name}.html, size: ${text.length}`);

        // Find all pinimg and pinterest links
        const matches = text.match(/https?:\/\/[a-zA-Z0-9.-]*(pinimg|pinterest)\.com[a-zA-Z0-9_./%-]*/g) || [];
        console.log(`[${name}] Total matches:`, matches.length);
        
        // Find specifically video/mp4/webm/m3u8/mov files
        const videos = matches.filter(m => m.match(/\.(mp4|mov|webm|m3u8)/i));
        console.log(`[${name}] Video matches:`, [...new Set(videos)]);
    } catch (e) {
        console.error(`Error checking ${url}:`, e);
    }
}

async function run() {
    await checkUrl("nature_search", "https://in.pinterest.com/search/pins/?q=videos%20of%20nature&rs=ac&len=9&source_id=ac_wrrmR9PX&eq=videos%20of&etslf=10417");
    await checkUrl("nature_pin", "https://in.pinterest.com/pin/30117891253294316/");
}
run();
