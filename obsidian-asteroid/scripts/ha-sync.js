const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');

const OPTIONS_FILE = '/data/options.json';

// The REAL static build output from the Dockerfile (NEXT_PUBLIC_EXPORT=true npm run build)
// With output: 'export', Next.js puts HTML/CSS/JS files in out/ directory by default.
// The .next_export directory was just the temporary build cache for the static build.
const STATIC_BUILD_DIR = path.join(__dirname, '../out');

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

            // Config is at /config/obsidian_asteroid/ — mapped via "map: config:rw"
            const CONFIG_DIR = '/config/obsidian_asteroid';
            const settingsFile = path.join(CONFIG_DIR, 'settings.json');
            const mediaDir = path.join(CONFIG_DIR, 'media');

            console.log(`Config dir: ${CONFIG_DIR}`);

            if (!fs.existsSync(STATIC_BUILD_DIR)) {
                console.warn('Static build dir missing, skipping data injection.');
            } else {
                // Copy scraper data into static build root
                if (fs.existsSync(scraperOutputFile)) {
                    fs.copyFileSync(scraperOutputFile, path.join(STATIC_BUILD_DIR, 'appointments.json'));
                    console.log('Injected appointments.json into static build.');
                }
                if (fs.existsSync(rssOutputFile)) {
                    fs.copyFileSync(rssOutputFile, path.join(STATIC_BUILD_DIR, 'rss.xml'));
                    console.log('Injected rss.xml into static build.');
                }

                // Copy settings.json into static build root AND into signage2/ subfolder.
                // Root:     used by new JS (fetch('../settings.json') from /signage2/)
                // signage2: used by old JS (fetch('settings.json') from /signage2/)
                if (fs.existsSync(settingsFile)) {
                    fs.copyFileSync(settingsFile, path.join(STATIC_BUILD_DIR, 'settings.json'));
                    console.log('Injected settings.json into static build root.');

                    const signage2Dir = path.join(STATIC_BUILD_DIR, 'signage2');
                    if (fs.existsSync(signage2Dir)) {
                        fs.copyFileSync(settingsFile, path.join(signage2Dir, 'settings.json'));
                        console.log('Also injected settings.json into signage2/ subfolder.');
                    }
                } else {
                    console.warn(`settings.json not found at: ${settingsFile}`);
                }

                // Copy media files into static build root/media AND signage2/media.
                // Root media:     used by new JS (fetch('../media/file.png') from /signage2/)
                // signage2/media: used by old JS (fetch('media/file.png') from /signage2/)
                if (fs.existsSync(mediaDir)) {
                    const staticMediaDir = path.join(STATIC_BUILD_DIR, 'media');
                    if (!fs.existsSync(staticMediaDir)) fs.mkdirSync(staticMediaDir, { recursive: true });

                    const signage2Dir = path.join(STATIC_BUILD_DIR, 'signage2');
                    const signage2MediaDir = path.join(signage2Dir, 'media');
                    if (fs.existsSync(signage2Dir) && !fs.existsSync(signage2MediaDir)) {
                        fs.mkdirSync(signage2MediaDir, { recursive: true });
                    }

                    const mediaFiles = fs.readdirSync(mediaDir).filter(f => !fs.statSync(path.join(mediaDir, f)).isDirectory());
                    for (const file of mediaFiles) {
                        try {
                            fs.copyFileSync(path.join(mediaDir, file), path.join(staticMediaDir, file));
                            if (fs.existsSync(signage2MediaDir)) {
                                fs.copyFileSync(path.join(mediaDir, file), path.join(signage2MediaDir, file));
                            }
                        } catch (e) {
                            console.error(`Failed to copy media file ${file}:`, e.message);
                        }
                    }
                    console.log(`Injected ${mediaFiles.length} media files into root/media and signage2/media.`);
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

                    // Settings hash to detect when user edits settings.json
                    let currentSettingsHash = '';
                    if (fs.existsSync(settingsFile)) {
                        const settingsContent = fs.readFileSync(settingsFile, 'utf8');
                        currentSettingsHash = settingsContent.length + '_' + settingsContent.slice(-32).replace(/\s/g, '');
                    }

                    // Media fingerprint: detect when any image has been replaced
                    let currentMediaHash = '';
                    if (fs.existsSync(mediaDir)) {
                        const mediaFiles = fs.readdirSync(mediaDir).sort();
                        currentMediaHash = mediaFiles.map(f => {
                            const stat = fs.statSync(path.join(mediaDir, f));
                            return `${f}:${stat.size}:${stat.mtimeMs}`;
                        }).join('|');
                    }

                    let lastSyncData = { timestamp: 0, version: '0.0.0', settingsHash: '', mediaHash: '' };
                    if (fs.existsSync(lastSyncFile)) {
                        try {
                            lastSyncData = JSON.parse(fs.readFileSync(lastSyncFile, 'utf8'));
                        } catch (e) { }
                    }

                    const isVersionUpgrade = currentVersion !== lastSyncData.version;
                    const isSettingsChanged = currentSettingsHash !== lastSyncData.settingsHash;
                    const isMediaChanged = currentMediaHash !== lastSyncData.mediaHash;
                    const forceFullSync = isVersionUpgrade || isSettingsChanged || isMediaChanged;

                    if (isVersionUpgrade) {
                        console.log(`Version changed (${lastSyncData.version} -> ${currentVersion}). Forcing full sync.`);
                    }
                    if (isSettingsChanged && !isVersionUpgrade) {
                        console.log('settings.json changed. Forcing full sync.');
                    }
                    if (isMediaChanged && !isVersionUpgrade) {
                        console.log('Media files changed. Forcing full sync.');
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
                                    if (forceFullSync || stats.mtimeMs > lastSyncData.timestamp) {
                                        console.log(`Uploading: ${item}${forceFullSync ? ' (Force)' : ''}`);
                                        await client.uploadFrom(localPath, item);
                                    }
                                }
                            }
                        }

                        await uploadChangedFiles(STATIC_BUILD_DIR, options.ftp_remote_path);

                        fs.writeFileSync(lastSyncFile, JSON.stringify({
                            timestamp: Date.now(),
                            version: currentVersion,
                            settingsHash: currentSettingsHash,
                            mediaHash: currentMediaHash
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
