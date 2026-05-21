async function test() {
    const url = "https://www.pinterest.com/search/pins/?q=fantasy%20wallpaper";
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        console.log("Status:", resp.status);
        const text = await resp.text();
        console.log("Body Length:", text.length);
        const pinimgMatches = text.match(/i\.pinimg\.com\/[^\s"'>]+/g) || [];
        
        const unique = [...new Set(pinimgMatches)];
        console.log("Total unique pinimg urls:", unique.length);
        console.log("First 50 unique urls:");
        console.log(unique.slice(0, 50));
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
