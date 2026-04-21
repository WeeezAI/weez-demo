const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Capture console output
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Capture failed requests
    page.on('requestfailed', request => {
        console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
    });

    try {
        console.log('Starting navigation...');
        await page.goto('http://localhost:5173/auth', { waitUntil: 'networkidle2' });

        console.log('Typing credentials...');
        await page.type('#email', 'sayyadshakilgdsc@gmail.com');
        await page.type('#password', '123sayyad');

        console.log('Clicking login...');
        const [response] = await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(e => console.log('No navigation happened')),
            page.click('button[type="submit"]')
        ]);

        console.log('Checking current URL...');
        console.log('Current URL:', page.url());

        // Wait a bit to catch any toast or redirect
        await page.waitForTimeout(3000);
        console.log('Final URL after timeout:', page.url());

    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        await browser.close();
    }
})();
