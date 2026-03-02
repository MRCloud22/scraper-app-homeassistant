const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');

const OPTIONS_FILE = '/data/options.json';
const OUTPUT_DIR = path.join(__dirname, '../out');

async function sync() {
    console.log('--- Starting Sync Service ---');

    if (!fs.existsSync(OPTIONS_FILE)) {
        console.error('Options file not found. Check if this is running in Home Assistant.');
        return;
    }

    // 1. Initial Build (once at startup to save resources)
    console.log('Step 1: Initial build for static export...');
    const buildEnv = {
        ...process.env,
        NEXT_PUBLIC_EXPORT: 'true',
        NEXT_PUBLIC_BASE_PATH: '' // Default to root
    };
    try {
        execSync('npm run build', { stdio: 'inherit', env: buildEnv });
    } catch (err) {
        console.error('Initial build failed:', err);
    }

    while (true) {
        try {
            // Re-read options to pick up interval or credential changes
            const options = JSON.parse(fs.readFileSync(OPTIONS_FILE, 'utf8'));
            const intervalMinutes = options.sync_interval || 60;

            console.log(`[${new Date().toLocaleString()}] Starting periodic sync (Interval: ${intervalMinutes} min)...`);

            // 2. Run Scraper
            console.log('Step 2: Running Scraper...');
            execSync('node /app/scripts/scrape.js', { stdio: 'inherit' });

            // 3. Update export folder with new data
            // Copy the new appointments.json to the static export folder
            const scraperOutputFile = path.join(__dirname, '../public/appointments.json');
            const exportOutputFile = path.join(OUTPUT_DIR, 'appointments.json');
            if (fs.existsSync(scraperOutputFile)) {
                fs.copyFileSync(scraperOutputFile, exportOutputFile);
                console.log('Updated appointments.json in export folder.');
            }

            // 4. FTP Upload
            if (options.enable_ftp) {
                console.log('Step 4: Uploading to FTP...');
                const client = new ftp.Client();
                client.ftp.verbose = true;
                try {
                    await client.access({
                        host: options.ftp_server,
                        user: options.ftp_user,
                        password: options.ftp_password,
                        port: options.ftp_port || 21,
                        secure: false
                    });

                    await client.ensureDir(options.ftp_remote_path);
                    await client.uploadFromDir(OUTPUT_DIR);
                    console.log('FTP Upload successful!');
                } catch (err) {
                    console.error('FTP Upload failed:', err);
                } finally {
                    client.close();
                }
            }

            console.log(`[${new Date().toLocaleString()}] Sync completed. Waiting ${intervalMinutes} minutes...`);
            // Wait for the next interval
            await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
        } catch (error) {
            console.error('Sync loop error:', error);
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 min on error
        }
    }
}

sync();
