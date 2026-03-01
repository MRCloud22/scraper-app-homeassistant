const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../public/appointments.json');

async function fetchTreatmentImage(browser, templateUrl, imageCache) {
    const templateMatch = templateUrl.match(/template\/(\d+)/);
    const templateId = templateMatch ? templateMatch[1] : null;

    if (templateId && imageCache[templateId]) {
        return imageCache[templateId];
    }

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(templateUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const imageUrl = await page.evaluate(() => {
            const img = document.querySelector('div#detail__main__layout__picture > img');
            return img ? img.src : null;
        });

        await page.close();
        if (templateId && imageUrl) {
            imageCache[templateId] = imageUrl;
        }
        return imageUrl;
    } catch (error) {
        console.error(`Error fetching image for ${templateUrl}:`, error);
        return null;
    }
}

async function scrape() {
    console.log('Starting scrape...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('https://shop.beautykuppel-therme-badaibling.de/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('Scrolling to load all appointments...');
        // Multiple small scrolls are often more effective for lazy loading
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 800));
            await new Promise(r => setTimeout(r, 1000));
        }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        console.log('Waiting for appointment rows...');
        let rowsExist = false;
        try {
            // Wait for the main container or specific rows
            await page.waitForSelector('a.table-row', { timeout: 15000 });
            rowsExist = true;
        } catch (e) {
            console.log('No appointment rows found (Shop might be fully booked).');
        }

        // Wait a bit more for React hydration if necessary
        await new Promise(r => setTimeout(r, 2000));

        const allAppointments = [];
        const seenKeys = new Set();

        if (rowsExist) {
            const paginationDots = await page.$$('.slideTabs a');
            console.log(`Found ${paginationDots.length} pagination pages in the appointment box.`);

            const pagesToClick = paginationDots.length > 0 ? paginationDots.length : 1;

            for (let i = 0; i < pagesToClick; i++) {
                if (paginationDots.length > 0) {
                    console.log(`Scraping page ${i + 1}...`);
                    await paginationDots[i].click();
                    await new Promise(r => setTimeout(r, 1000)); // Wait for animation/load
                }

                const pageData = await page.evaluate(() => {
                    // Find all containers that might hold appointments
                    // Based on the structure, we want the ones near the title "Eine Auswahl der nächsten freien Termine"
                    const sections = Array.from(document.querySelectorAll('div'));
                    const selectionSection = sections.find(s => s.textContent.includes('Eine Auswahl der nächsten freien Termine') && s.querySelector('a.table-row'));

                    if (!selectionSection) return [];

                    const rows = selectionSection.querySelectorAll('a.table-row');
                    return Array.from(rows).map(row => {
                        const cells = row.querySelectorAll('.table-cell');
                        const treatmentEl = row.querySelector('.one-line span') || row.querySelector('.table-cell:nth-child(3)');
                        const href = row.getAttribute('href') || '';

                        const date = cells[0]?.textContent?.trim() || '';
                        const time = cells[1]?.textContent?.trim() || '';
                        const treatment = treatmentEl?.textContent?.trim() || '';
                        const price = cells[3]?.textContent?.trim() || '';

                        const rawHref = href.startsWith('http') ? href : `https://shop.beautykuppel-therme-badaibling.de/${href}`;
                        const bookingUrl = rawHref.replace(/([?&])dsId=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');

                        return { date, time, treatment, price, bookingUrl };
                    }).filter(a => a.date && a.time && a.treatment);
                });

                for (const apt of pageData) {
                    const key = `${apt.date}-${apt.time}-${apt.treatment}`;
                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        allAppointments.push(apt);
                    }
                }
            }
        }

        const basicAppointments = allAppointments;

        console.log(`Found ${basicAppointments.length} appointments. Fetching images...`);
        if (basicAppointments.length > 0) {
            console.log('Sample appointment:', JSON.stringify(basicAppointments[0], null, 2));
        }

        const imageCache = {};
        const uniqueTemplates = new Map();
        for (const apt of basicAppointments) {
            const match = apt.bookingUrl.match(/template\/(\d+)/);
            if (match && !uniqueTemplates.has(match[1])) {
                uniqueTemplates.set(match[1], apt.bookingUrl);
            }
        }

        const templateIds = Array.from(uniqueTemplates.keys());
        for (let i = 0; i < templateIds.length; i += 3) {
            const batch = templateIds.slice(i, i + 3);
            await Promise.all(batch.map(id => fetchTreatmentImage(browser, uniqueTemplates.get(id), imageCache)));
        }

        const appointments = basicAppointments.map(apt => {
            const match = apt.bookingUrl.match(/template\/(\d+)/);
            const id = match ? match[1] : null;
            return { ...apt, imageUrl: id ? imageCache[id] || null : null };
        });

        const data = {
            success: true,
            appointments,
            count: appointments.length,
            lastUpdated: new Date().toISOString()
        };

        console.log(`Final data count: ${data.appointments.length}`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
        console.log(`Successfully saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Scrape failed:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

scrape();
