const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('ERR:', err.toString()));

    // Inject session
    await page.goto('http://localhost:8080/login.html');
    await page.evaluate(() => {
        sessionStorage.setItem('JUDGE_SESSION', JSON.stringify({
            id: 'judge_01',
            name: '김광고',
            allowedMainCategories: ['integrated_marketing', 'marketing_campaign']
        }));
    });

    await page.goto('http://localhost:8080/judging.html');
    await page.waitForTimeout(2000);
    await browser.close();
})();
