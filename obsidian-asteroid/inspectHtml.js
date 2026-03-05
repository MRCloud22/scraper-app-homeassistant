const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://shop.beautykuppel-therme-badaibling.de/', { waitUntil: 'networkidle2' });
    const selection = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('div'));
        const selectionSection = sections.find(s => s.textContent.includes('Eine Auswahl der nächsten freien Termine') && s.querySelector('a.table-row'));
        if (!selectionSection) return 'Not found';
        const rows = selectionSection.querySelectorAll('a.table-row');
        return Array.from(rows).map(row => {
            const cells = row.querySelectorAll('.table-cell');
            return cells[3]?.innerHTML;
        });
    });
    console.log(selection);
    await browser.close();
})();
