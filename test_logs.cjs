const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set a dummy sessionStorage to bypass login redirect
    await page.evaluateOnNewDocument(() => {
        sessionStorage.setItem('currentJudge', JSON.stringify({
            id: 'test_judge',
            name: '테스트',
            allowedMainCategories: ['integrated_marketing', 'digital_creative']
        }));
    });

    page.on('console', msg => {
        console.log(`[PAGE LOG][${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.log('[PAGE ERROR]', err.message);
    });

    const fileUrl = 'file://' + path.resolve(__dirname, 'judging.html');
    console.log('Navigating to:', fileUrl);

    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
})();
