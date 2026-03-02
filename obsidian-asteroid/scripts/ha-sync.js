const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');

const OPTIONS_FILE = '/data/options.json';

// The REAL static build output from the Dockerfile (NEXT_PUBLIC_EXPORT=true npm run build)
// next.config.ts sets distDir: '.next_export' when NEXT_PUBLIC_EXPORT=true
// With output: 'export', Next.js puts files in <distDir>/ directly
const STATIC_BUILD_DIR = path.join(__dirname, '../.next_export');

async function sync() {
    console.log('--- Starting Sync Service ---');

    if (!fs.existsSync(OPTIONS_FILE)) {
        console.error('Options file not found. Check if this is running in Home Assistant.');
        return;
    }

    // 1. Verify the static build exists
    console.log('Step 1: Verifying static build assets...');
    if (!fs.existsSync(STATIC_BUILD_DIR)) {
        console.error(`Static build directory not found: ${STATIC_BUILD_DIR}`);
        console.error('The Docker image may not have been built correctly.');
        console.log('Available directories in /app:');
        try {
            fs.readdirSync('/app').forEach(f => console.log(' -', f));
        } catch (e) { }
    } else {
        const fileCount = fs.readdirSync(STATIC_BUILD_DIR).length;
        console.log(`Static build OK: ${STATIC_BUILD_DIR} (${fileCount} items)`);
    }

    while (true) {
        try {
            const options = JSON.parse(fs.readFileSync(OPTIONS_FILE, 'utf8'));
            const intervalMinutes = options.sync_interval || 60;

            console.log(`[${new Date().toLocaleString()}] Starting periodic sync (Interval: ${intervalMinutes} min)...`);

            // 2. Run Scraper
            console.log('Step 2: Running Scraper...');
            execSync('node /app/scripts/scrape.js', { stdio: 'inherit' });

            // 2.5 Generate RSS Feed
            console.log('Step 2.5: Generating RSS Feed...');
            execSync('node /app/scripts/generate-rss.js', { stdio: 'inherit' });

            // 3. Inject dynamic data and config files INTO the static build directory
            console.log('Step 3: Injecting dynamic data into static build...');

            const scraperOutputFile = path.join(__dirname, '../public/appointments.json');
            const rssOutputFile = path.join(__dirname, '../public/rss.xml');

            // Configuration source: check for the actual subdirectory, not just the parent
            const configBase = fs.existsSync('/addon_config/obsidian_asteroid') ? '/addon_config' : '/config';
            const settingsFile = path.join(configBase, 'obsidian_asteroid/settings.json');
            const mediaDir = path.join(configBase, 'obsidian_asteroid/media');

            console.log(`Config source: ${configBase}`);

            if (!fs.existsSync(STATIC_BUILD_DIR)) {
                console.warn('Static build dir missing, skipping data injection.');
            } else {
                // Copy scraper data into static build
                if (fs.existsSync(scraperOutputFile)) {
                    fs.copyFileSync(scraperOutputFile, path.join(STATIC_BUILD_DIR, 'appointments.json'));
                    console.log('Injected appointments.json into static build.');
                }
                if (fs.existsSync(rssOutputFile)) {
                    fs.copyFileSync(rssOutputFile, path.join(STATIC_BUILD_DIR, 'rss.xml'));
                    console.log('Injected rss.xml into static build.');
                }

                // Copy settings.json into static build
                if (fs.existsSync(settingsFile)) {
                    fs.copyFileSync(settingsFile, path.join(STATIC_BUILD_DIR, 'settings.json'));
                    console.log('Injected settings.json into static build.');
                } else {
                    console.warn(`settings.json not found at: ${settingsFile}`);
                }

                // Copy media files into static build
                if (fs.existsSync(mediaDir)) {
                    const staticMediaDir = path.join(STATIC_BUILD_DIR, 'media');
                    if (!fs.existsSync(staticMediaDir)) fs.mkdirSync(staticMediaDir, { recursive: true });

                    const mediaFiles = fs.readdirSync(mediaDir).filter(f => !fs.statSync(path.join(mediaDir, f)).isDirectory());
                    for (const file of mediaFiles) {
                        try {
                            fs.copyFileSync(path.join(mediaDir, file), path.join(staticMediaDir, file));
                        } catch (e) {
                            console.error(`Failed to copy media file ${file}:`, e.message);
                        }
                    }
                    console.log(`Injected ${mediaFiles.length} media files into static build.`);
                } else {
                    console.warn(`Media directory not found at: ${mediaDir}`);
                }
            }

            // 4. FTP Upload
            if (options.enable_ftp) {
                if (!fs.existsSync(STATIC_BUILD_DIR)) {
                    console.error('Cannot upload: static build directory not found.');
                } else {
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

                        async function uploadChangedFiles(localDir, remoteDir) {
                            const items = fs.readdirSync(localDir);
                            for (const item of items) {
                                if (item === 'node_modules' || item === '.git') continue;

                                const localPath = path.join(localDir, item);
                                const stats = fs.statSync(localPath);

                                if (stats.isDirectory()) {
                                    await client.ensureDir(item);
                                    await uploadChangedFiles(localPath, path.join(remoteDir, item));
                                    await client.cd('..');
                                } else {
                                    if (isVersionUpgrade || stats.mtimeMs > lastSyncData.timestamp) {
                                        console.log(`Uploading: ${item}${isVersionUpgrade ? ' (Force)' : ''}`);
                                        await client.uploadFrom(localPath, item);
                                    }
                                }
                            }
                        }

                        await uploadChangedFiles(STATIC_BUILD_DIR, options.ftp_remote_path);

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
            }

            console.log(`[${new Date().toLocaleString()}] Sync completed. Waiting ${intervalMinutes} minutes...`);
            await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
        } catch (error) {
            console.error('Sync loop error:', error);
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
}

sync();
