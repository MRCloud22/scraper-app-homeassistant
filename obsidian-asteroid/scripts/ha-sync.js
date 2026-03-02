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

    // 1. Verification of Pre-built Assets
    console.log('Step 1: Verifying production assets...');
    if (!fs.existsSync(OUTPUT_DIR)) {
        console.log('Creating out directory for first-run consistency...');
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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

            // 2.5 Generate RSS Feed
            console.log('Step 2.5: Generating RSS Feed...');
            execSync('node /app/scripts/generate-rss.js', { stdio: 'inherit' });

            // 3. Update data files
            const scraperOutputFile = path.join(__dirname, '../public/appointments.json');
            const rssOutputFile = path.join(__dirname, '../public/rss.xml');

            const exportOutputFile = path.join(OUTPUT_DIR, 'appointments.json');
            const exportRssFile = path.join(OUTPUT_DIR, 'rss.xml');

            // Synchronize files to the export folder for FTP
            if (fs.existsSync(scraperOutputFile)) {
                if (!fs.existsSync(OUTPUT_DIR)) {
                    console.log('Re-creating missing export directory...');
                    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
                }

                fs.copyFileSync(scraperOutputFile, exportOutputFile);
                console.log('Synchronized appointments.json to export container.');

                if (fs.existsSync(rssOutputFile)) {
                    fs.copyFileSync(rssOutputFile, exportRssFile);
                    console.log('Synchronized rss.xml to export container.');
                }
            } else {
                console.warn('Scraper output missing! Check scraper logs.');
            }

            // 4. FTP Upload
            if (options.enable_ftp) {
                console.log('Step 4: Uploading to FTP (Differential)...');
                const client = new ftp.Client();
                // client.ftp.verbose = true; // Set to false for cleaner logs

                const lastSyncFile = '/data/last_sync.json';
                let lastSyncTime = 0;
                if (fs.existsSync(lastSyncFile)) {
                    lastSyncTime = JSON.parse(fs.readFileSync(lastSyncFile, 'utf8')).timestamp;
                }

                try {
                    await client.access({
                        host: options.ftp_server,
                        user: options.ftp_user,
                        password: options.ftp_password,
                        port: options.ftp_port || 21,
                        secure: false
                    });

                    await client.ensureDir(options.ftp_remote_path);

                    // Recursive function to upload only changed files
                    async function uploadChangedFiles(localDir, remoteDir) {
                        const items = fs.readdirSync(localDir);
                        for (const item of items) {
                            const localPath = path.join(localDir, item);
                            const remotePath = path.join(remoteDir, item);
                            const stats = fs.statSync(localPath);

                            if (stats.isDirectory()) {
                                await client.ensureDir(remotePath);
                                await uploadChangedFiles(localPath, remotePath);
                                await client.cd('..'); // Go back up after directory recursion
                            } else {
                                if (stats.mtimeMs > lastSyncTime) {
                                    console.log(`Uploading changed file: ${item}`);
                                    await client.uploadFrom(localPath, item);
                                }
                            }
                        }
                    }

                    await uploadChangedFiles(OUTPUT_DIR, options.ftp_remote_path);

                    // Update sync time
                    fs.writeFileSync(lastSyncFile, JSON.stringify({ timestamp: Date.now() }));
                    console.log('Differential FTP Upload successful!');
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
