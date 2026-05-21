async function test() {
    const url = "https://www.pinterest.com/search/pins/?q=fantasy%20wallpaper";
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        const text = await resp.text();
        const re = /(https?:)?\\?\/\\?\/i\.pinimg\.com\\?\/[^"'\s>]+/g;
        const matches = text.match(re) || [];
        console.log("Found matches count:", matches.length);
        console.log("Matches:", matches.slice(0, 10));
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
