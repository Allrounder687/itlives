const fs = require('fs');

async function test() {
    const url = "https://in.pinterest.com/search/pins/?q=videos&rs=rs&source_id=rs_dpqRYIa1&top_pin_ids=144748575525138225&eq=&etslf=1794";
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
            }
        });
        const text = await resp.text();
        fs.writeFileSync('pinterest_fetched_desktop.html', text, 'utf8');
        console.log("Saved pinterest_fetched_desktop.html, size:", text.length);

        // Find all pinimg and pinterest links
        const matches = text.match(/https?:\/\/[a-zA-Z0-9.-]*(pinimg|pinterest)\.com[a-zA-Z0-9_./%-]*/g) || [];
        console.log("Total pinimg/pinterest matches:", matches.length);
        
        // Find specifically video/mp4/webm/m3u8/mov files
        const videos = matches.filter(m => m.match(/\.(mp4|mov|webm|m3u8)/i));
        console.log("Video matches:", [...new Set(videos)]);

        // Find candidate script tags
        const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        let count = 0;
        while ((match = scriptRegex.exec(text)) !== null) {
            const content = match[1].trim();
            if (content.includes('initialReduxState') || content.startsWith('{"otaData"') || content.includes('reduxState')) {
                console.log(`Found candidate script with length ${content.length}`);
                // Count pins
                try {
                    const cleanJson = content.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
                    const data = JSON.parse(content);
                    if (data.initialReduxState && data.initialReduxState.pins) {
                        console.log("Total pins in desktop initialReduxState:", Object.keys(data.initialReduxState.pins).length);
                    }
                } catch (e) {
                    // Try regex
                    const pinsMatch = content.match(/"pins":\s*\{/g);
                    console.log("Pins match count:", pinsMatch ? pinsMatch.length : 0);
                }
                count++;
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
