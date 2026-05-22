const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
        
        await page.goto('http://localhost:3000/?mode=desktop-overlay');
        console.log("Navigated to overlay");
        
        await new Promise(r => setTimeout(r, 5000));
        await page.screenshot({path: '../test_webgl_initial.png'});
        
        await browser.close();
        console.log("Done");
    } catch (e) {
        console.error(e);
    }
})();
