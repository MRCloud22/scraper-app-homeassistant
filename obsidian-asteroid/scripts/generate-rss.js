/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const APPOINTMENTS_FILE = path.join(__dirname, '../public/appointments.json');
const RSS_OUTPUT_PUBLIC = path.join(__dirname, '../public/rss.xml');
const RSS_OUTPUT_OUT = path.join(__dirname, '../out/rss.xml');

function generateRss() {
  console.log('Generating RSS Feed...');

  if (!fs.existsSync(APPOINTMENTS_FILE)) {
    console.error('Appointments file not found. Skipping RSS generation.');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(APPOINTMENTS_FILE, 'utf8'));
    const appointments = data.appointments || [];

    let emptyStateText = "Aktuell sind keine freien Termine vorhanden.";
    const CONFIG_DIR = '/config/obsidian_asteroid';
    const settingsFile = path.join(CONFIG_DIR, 'settings.json');
    if (fs.existsSync(settingsFile)) {
      try {
        const settingsData = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        if (settingsData && settingsData.signage2 && settingsData.signage2.emptyText) {
          emptyStateText = settingsData.signage2.emptyText;
        } else if (settingsData && settingsData.emptyText) {
          emptyStateText = settingsData.emptyText;
        }
      } catch (e) {
        console.error('Failed to parse settings.json:', e);
      }
    }

    let rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Beautykuppel Therme - Freie Termine</title>
  <link>https://shop.beautykuppel-therme-badaibling.de/</link>
  <description>Aktuelle freie Wellness-Termine in Bad Aibling</description>
  <language>de-de</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;

    if (appointments.length === 0) {
      rss += `
  <item>
    <title>${emptyStateText}</title>
    <link>https://shop.beautykuppel-therme-badaibling.de/</link>
    <guid isPermaLink="false">empty-state</guid>
    <pubDate>${new Date().toUTCString()}</pubDate>
  </item>`;
    } else {
      // Intro item at the very beginning
      rss += `
  <item>
    <title>Heutige freie Termine</title>
    <link>https://shop.beautykuppel-therme-badaibling.de/</link>
    <guid isPermaLink="false">separator-start</guid>
    <pubDate>${new Date().toUTCString()}</pubDate>
  </item>`;

      appointments.forEach((app, index) => {
        const guid = Buffer.from(`${app.date}-${app.time}-${app.treatment}`).toString('base64');
        const timeFormatted = (app.time || '').replace(':', '.');
        const priceFormatted = (app.price || '').replace(/\.00\s*€?$/, '').replace(/€/, '').trim();
        const priceDisplay = priceFormatted ? `${priceFormatted} €` : '';

        rss += `
  <item>
    <title>${app.treatment} um ${timeFormatted} Uhr${priceDisplay ? ` für ${priceDisplay}` : ''}</title>
    <link>${(app.bookingUrl || '').replace(/&/g, '&amp;')}</link>
    <guid isPermaLink="false">${guid}</guid>
    <pubDate>${new Date().toUTCString()}</pubDate>
  </item>`;

        // Insert separator item after every 3 appointments
        if ((index + 1) % 3 === 0) {
          rss += `
  <item>
    <title>Heutige freie Termine</title>
    <link>https://shop.beautykuppel-therme-badaibling.de/</link>
    <guid isPermaLink="false">separator-${Math.floor(index / 3)}</guid>
    <pubDate>${new Date().toUTCString()}</pubDate>
  </item>`;
        }
      });
    }

    rss += `
</channel>
</rss>`;

    fs.writeFileSync(RSS_OUTPUT_PUBLIC, rss);
    console.log(`RSS Feed saved to ${RSS_OUTPUT_PUBLIC}`);

    // Also save to 'out' folder if it exists (for FTP)
    const outDir = path.dirname(RSS_OUTPUT_OUT);
    if (fs.existsSync(outDir)) {
      fs.writeFileSync(RSS_OUTPUT_OUT, rss);
      console.log(`RSS Feed synchronized to ${RSS_OUTPUT_OUT}`);
    }

  } catch (err) {
    console.error('Failed to generate RSS:', err);
  }
}

generateRss();
