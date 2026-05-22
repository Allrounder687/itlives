const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        await page.goto('http://localhost:3000/?mode=desktop-overlay');
        console.log("Navigated to overlay");
        
        await new Promise(r => setTimeout(r, 5000));
        
        // Let's capture the current canvas without mouse movement
        await page.screenshot({path: '../test_desktop_initial.png'});
        
        // Wait another 2 seconds to see if the fake timer simulator draws red particles
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({path: '../test_desktop_after_fake.png'});
        
        await browser.close();
        console.log("Done");
    } catch (e) {
        console.error(e);
    }
})();
