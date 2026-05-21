const fs = require('fs');

const content = fs.readFileSync('script_0.js', 'utf8');
try {
    const data = JSON.parse(content);
    const pins = data.initialReduxState.pins;
    const pinIds = Object.keys(pins);
    console.log("Total pins in initialReduxState.pins:", pinIds.length);
    
    let videoPinsCount = 0;
    for (let id of pinIds) {
        const pin = pins[id];
        const hasVideos = !!pin.videos;
        const hasStoryVideos = !!(pin.story_pin_data && pin.story_pin_data.pages && pin.story_pin_data.pages.some(p => p.blocks && p.blocks.some(b => b.video)));
        
        if (hasVideos || hasStoryVideos) {
            videoPinsCount++;
            console.log(`Pin ${id}: hasVideos=${hasVideos}, hasStoryVideos=${hasStoryVideos}`);
            if (pin.videos) {
                console.log("  Videos object:", JSON.stringify(pin.videos));
            }
            if (pin.story_pin_data) {
                console.log("  Story pin pages count:", pin.story_pin_data.pages.length);
            }
        }
    }
    console.log("Total video pins identified:", videoPinsCount);
} catch (e) {
    console.error("Failed to parse script_0.js:", e);
}
