import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await page.goto('http://localhost:5173/SplitTab.github.io/');
    
    // Create a dummy image
    const execSync = require('child_process').execSync;
    execSync('convert -size 100x100 xc:white dummy.jpg');
    
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(path.resolve('./dummy.jpg'));
    
    await page.waitForTimeout(5000);
    
    await browser.close();
})();
