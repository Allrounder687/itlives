async function test() {
    const urls = [
        "https://i.pinimg.com/originals/1d/f4/3f/1df43fcab7890c74479338e08b29aad0.jpg",
        "https://i.pinimg.com/736x/1d/f4/3f/1df43fcab7890c74479338e08b29aad0.jpg"
    ];
    for (const url of urls) {
        try {
            const resp = await fetch(url, { method: 'HEAD' });
            console.log(url, "->", resp.status);
        } catch (e) {
            console.error(url, "-> Error:", e.message);
        }
    }
}
test();
