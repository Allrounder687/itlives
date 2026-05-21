const fs = require('fs');

async function test() {
    const url = "https://www.pinterest.com/search/pins/?q=live%20wallpaper";
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        const text = await resp.text();
        fs.writeFileSync('pinterest_live_wallpapers.html', text, 'utf8');
        console.log("Saved pinterest_live_wallpapers.html, size:", text.length);

        // Find all pinimg and pinterest links
        const matches = text.match(/https?:\/\/[a-zA-Z0-9.-]*(pinimg|pinterest)\.com[a-zA-Z0-9_./%-]*/g) || [];
        console.log("Total pinimg/pinterest matches:", matches.length);
        
        // Find specifically video/mp4/webm/m3u8/mov files
        const videos = matches.filter(m => m.match(/\.(mp4|mov|webm|m3u8)/i));
        console.log("Video matches:", [...new Set(videos)]);

        // Check redux state pins
        const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        let found = false;
        while ((match = scriptRegex.exec(text)) !== null) {
            const content = match[1].trim();
            if (content.includes('initialReduxState') || content.startsWith('{"otaData"') || content.includes('reduxState')) {
                try {
                    const data = JSON.parse(content);
                    if (data.initialReduxState && data.initialReduxState.pins) {
                        const pins = data.initialReduxState.pins;
                        const ids = Object.keys(pins);
                        console.log("Total pins in redux state:", ids.length);
                        let vCount = 0;
                        for (let id of ids) {
                            if (pins[id].videos || (pins[id].story_pin_data && pins[id].story_pin_data.pages && pins[id].story_pin_data.pages.some(p => p.blocks && p.blocks.some(b => b.video)))) {
                                vCount++;
                            }
                        }
                        console.log("Video pins count in redux state:", vCount);
                    }
                } catch (e) {
                    console.log("Failed to parse JSON script tag in live wallpapers search");
                }
                found = true;
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
