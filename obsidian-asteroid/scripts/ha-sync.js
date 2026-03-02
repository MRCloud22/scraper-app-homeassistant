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

            // Configuration source (prioritize /addon_config)
            const configBase = fs.existsSync('/addon_config') ? '/addon_config' : '/config';
            const settingsFile = path.join(configBase, 'obsidian_asteroid/settings.json');
            const mediaDir = path.join(configBase, 'obsidian_asteroid/media');

            // Find the best export directory
            const possibleDirs = [
                path.join(__dirname, '../out'),
                path.join(__dirname, '../.next_export'),
                path.join(__dirname, '../dist')
            ];
            let activeOutputDir = possibleDirs.find(d => fs.existsSync(d) && fs.readdirSync(d).length > 0) || OUTPUT_DIR;

            console.log(`Step 3: Preparing export (Source: ${activeOutputDir})...`);

            // Synchronize files to the export folder for FTP
            if (!fs.existsSync(activeOutputDir)) {
                fs.mkdirSync(activeOutputDir, { recursive: true });
            }

            // Copy scraper data
            if (fs.existsSync(scraperOutputFile)) {
                fs.copyFileSync(scraperOutputFile, path.join(activeOutputDir, 'appointments.json'));
                console.log('Synchronized appointments.json to export folder.');
            }
            if (fs.existsSync(rssOutputFile)) {
                fs.copyFileSync(rssOutputFile, path.join(activeOutputDir, 'rss.xml'));
                console.log('Synchronized rss.xml to export folder.');
            }

            // Copy settings and media for static board support
            if (fs.existsSync(settingsFile)) {
                fs.copyFileSync(settingsFile, path.join(activeOutputDir, 'settings.json'));
                console.log('Synchronized settings.json to export folder.');
            }

            if (fs.existsSync(mediaDir)) {
                const staticMediaDir = path.join(activeOutputDir, 'media');
                if (!fs.existsSync(staticMediaDir)) fs.mkdirSync(staticMediaDir, { recursive: true });

                const mediaFiles = fs.readdirSync(mediaDir);
                for (const file of mediaFiles) {
                    try {
                        fs.copyFileSync(path.join(mediaDir, file), path.join(staticMediaDir, file));
                    } catch (e) {
                        console.error(`Failed to copy media file ${file}:`, e.message);
                    }
                }
                console.log(`Synchronized ${mediaFiles.length} media files to export folder.`);
            }

            // 4. FTP Upload
            if (options.enable_ftp) {
                console.log('Step 4: Uploading to FTP...');
                const client = new ftp.Client();
                const lastSyncFile = '/data/last_sync.json';

                // Version check for force sync
                const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
                const currentVersion = pkg.version;

                let lastSyncData = { timestamp: 0, version: '0.0.0' };
                if (fs.existsSync(lastSyncFile)) {
                    try {
                        lastSyncData = JSON.parse(fs.readFileSync(lastSyncFile, 'utf8'));
                    } catch (e) { }
                }

                const isVersionUpgrade = currentVersion !== lastSyncData.version;
                if (isVersionUpgrade) {
                    console.log(`Version changed (${lastSyncData.version} -> ${currentVersion}). Forcing full sync.`);
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
                            if (item === 'node_modules' || item === '.git') continue;

                            const localPath = path.join(localDir, item);
                            const remotePath = path.join(remoteDir, item);
                            const stats = fs.statSync(localPath);

                            if (stats.isDirectory()) {
                                await client.ensureDir(remotePath);
                                await uploadChangedFiles(localPath, remotePath);
                                await client.cd('..');
                            } else {
                                // Upload if newer than last sync OR if version changed
                                if (isVersionUpgrade || stats.mtimeMs > lastSyncData.timestamp) {
                                    console.log(`Uploading: ${item}${isVersionUpgrade ? ' (Force)' : ''}`);
                                    await client.uploadFrom(localPath, item);
                                }
                            }
                        }
                    }

                    await uploadChangedFiles(activeOutputDir, options.ftp_remote_path);

                    // Update sync time and version
                    fs.writeFileSync(lastSyncFile, JSON.stringify({
                        timestamp: Date.now(),
                        version: currentVersion
                    }));
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
