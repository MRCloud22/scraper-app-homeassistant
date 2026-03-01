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

    const options = JSON.parse(fs.readFileSync(OPTIONS_FILE, 'utf8'));

    if (!options.enable_ftp) {
        console.log('FTP Upload is disabled. Sync service will exit.');
        return;
    }

    const intervalMinutes = options.sync_interval || 60;
    console.log(`Sync interval: ${intervalMinutes} minutes.`);

    while (true) {
        try {
            console.log(`[${new Date().toLocaleString()}] Starting periodic sync...`);

            // 1. Run Scraper
            console.log('Step 1: Running Scraper...');
            execSync('node /app/scripts/scrape.js', { stdio: 'inherit' });

            // 2. Build for static export
            console.log('Step 2: Building for static export...');
            process.env.NEXT_PUBLIC_EXPORT = 'true';
            execSync('npm run build', { stdio: 'inherit' });

            // 3. FTP Upload
            console.log('Step 3: Uploading to FTP...');
            const client = new ftp.Client();
            client.ftp.verbose = true;
            try {
                await client.access({
                    host: options.ftp_server,
                    user: options.ftp_user,
                    password: options.ftp_password,
                    port: options.ftp_port || 21,
                    secure: false // Most simple FTP servers don't use TLS, user can update this if needed
                });

                console.log(`Ensuring remote directory: ${options.ftp_remote_path}`);
                await client.ensureDir(options.ftp_remote_path);

                console.log(`Uploading contents of ${OUTPUT_DIR} to ${options.ftp_remote_path}`);
                await client.uploadFromDir(OUTPUT_DIR);

                console.log('FTP Upload successful!');
            } catch (err) {
                console.error('FTP Upload failed:', err);
            } finally {
                client.close();
            }

            console.log(`[${new Date().toLocaleString()}] Sync completed. Waiting ${intervalMinutes} minutes...`);
        } catch (error) {
            console.error('Sync failed with error:', error);
        }

        // Wait for the next interval
        await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
    }
}

sync();
