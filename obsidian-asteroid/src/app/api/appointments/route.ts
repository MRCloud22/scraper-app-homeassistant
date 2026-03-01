import puppeteer, { Browser, Page } from 'puppeteer';
import { NextResponse } from 'next/server';

interface Appointment {
    date: string;
    time: string;
    treatment: string;
    price: string;
    bookingUrl: string;
    imageUrl: string | null;
}

// Cache for treatment images to avoid re-fetching
const imageCache = new Map<string, string>();

async function fetchTreatmentImage(
    browser: Browser,
    templateUrl: string
): Promise<string | null> {
    // Extract template ID from URL for caching
    const templateMatch = templateUrl.match(/template\/(\d+)/);
    const templateId = templateMatch ? templateMatch[1] : null;

    if (templateId && imageCache.has(templateId)) {
        return imageCache.get(templateId) || null;
    }

    try {
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        );

        // Only load document, skip images/styles for speed
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(templateUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 10000,
        });

        const imageUrl = await page.evaluate(() => {
            const img = document.querySelector(
                'div#detail__main__layout__picture > img'
            ) as HTMLImageElement;
            return img?.src || null;
        });

        await page.close();

        if (templateId && imageUrl) {
            imageCache.set(templateId, imageUrl);
        }

        return imageUrl;
    } catch (error) {
        console.error(`Error fetching image for ${templateUrl}:`, error);
        return null;
    }
}

export async function GET() {
    let browser: Browser | null = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        await page.goto('https://shop.beautykuppel-therme-badaibling.de/', {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        // Scroll to load appointments
        await page.evaluate(() => window.scrollBy(0, 1500));
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForSelector('a.table-row', { timeout: 15000 }).catch(() => null);

        // Extract basic appointment data
        const basicAppointments = await page.evaluate(() => {
            const rows = document.querySelectorAll('a.table-row');
            const results: Array<{
                date: string;
                time: string;
                treatment: string;
                price: string;
                bookingUrl: string;
            }> = [];

            rows.forEach((row) => {
                const cells = row.querySelectorAll('.table-cell');
                if (cells.length >= 4) {
                    const date = cells[0]?.textContent?.trim() || '';
                    const time = cells[1]?.textContent?.trim() || '';
                    const treatmentEl = row.querySelector('.one-line span');
                    const treatment = treatmentEl?.textContent?.trim() || '';
                    const price = cells[3]?.textContent?.trim() || '';
                    const href = row.getAttribute('href') || '';

                    if (date && time && treatment) {
                        results.push({
                            date,
                            time,
                            treatment,
                            price,
                            bookingUrl: href.startsWith('http')
                                ? href
                                : `https://shop.beautykuppel-therme-badaibling.de/${href}`,
                        });
                    }
                }
            });

            return results;
        });

        await page.close();

        // Fetch images for unique treatments (limit concurrent requests)
        const uniqueTemplates = new Map<string, string>();
        for (const apt of basicAppointments) {
            const templateMatch = apt.bookingUrl.match(/template\/(\d+)/);
            if (templateMatch && !uniqueTemplates.has(templateMatch[1])) {
                uniqueTemplates.set(templateMatch[1], apt.bookingUrl);
            }
        }

        // Fetch images in parallel (max 3 at a time to avoid overload)
        const templateIds = Array.from(uniqueTemplates.keys());
        for (let i = 0; i < templateIds.length; i += 3) {
            const batch = templateIds.slice(i, i + 3);
            await Promise.all(
                batch.map((id) =>
                    fetchTreatmentImage(browser!, uniqueTemplates.get(id)!)
                )
            );
        }

        // Map images to appointments
        const appointments: Appointment[] = basicAppointments.map((apt) => {
            const templateMatch = apt.bookingUrl.match(/template\/(\d+)/);
            const templateId = templateMatch ? templateMatch[1] : null;
            const imageUrl = templateId ? imageCache.get(templateId) || null : null;

            return {
                ...apt,
                imageUrl,
            };
        });

        await browser.close();

        return NextResponse.json({
            success: true,
            appointments,
            count: appointments.length,
            lastUpdated: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error fetching appointments:', error);

        if (browser) {
            await browser.close();
        }

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error ? error.message : 'Failed to fetch appointments',
                appointments: [],
            },
            { status: 500 }
        );
    }
}
