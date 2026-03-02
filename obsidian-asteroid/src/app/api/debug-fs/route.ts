import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    const results: Record<string, any> = {};

    // 1. Find ALL settings.json files everywhere
    try {
        const found = execSync(
            'find / -name "settings.json" -type f 2>/dev/null | head -20',
            { timeout: 10000 }
        ).toString().trim();
        results.allSettingsJson = found ? found.split('\n') : [];
    } catch (e: any) {
        results.allSettingsJson = `ERROR: ${e.message}`;
    }

    // 2. Show mount points
    try {
        results.mounts = execSync('mount | grep -v "proc\\|sys\\|cgroup\\|tmpfs\\|devpts"', { timeout: 5000 })
            .toString().trim().split('\n');
    } catch (e: any) {
        results.mounts = `ERROR: ${e.message}`;
    }

    // 3. List /config/addons_config/ recursively (2 levels deep)
    try {
        if (fs.existsSync('/config/addons_config')) {
            const listing = execSync('find /config/addons_config -maxdepth 3 -type f 2>/dev/null | head -30', { timeout: 5000 })
                .toString().trim();
            results.addonsConfigFiles = listing ? listing.split('\n') : [];

            // Also list directories
            const dirs = execSync('find /config/addons_config -maxdepth 2 -type d 2>/dev/null', { timeout: 5000 })
                .toString().trim();
            results.addonsConfigDirs = dirs ? dirs.split('\n') : [];
        } else {
            results.addonsConfigFiles = '/config/addons_config does NOT exist';
        }
    } catch (e: any) {
        results.addonsConfigFiles = `ERROR: ${e.message}`;
    }

    // 4. List /addon_config/ contents
    try {
        if (fs.existsSync('/addon_config')) {
            results.addonConfigContents = fs.readdirSync('/addon_config');
            // Read the settings.json content
            const sf = '/addon_config/settings.json';
            if (fs.existsSync(sf)) {
                results.addonConfigSettingsContent = fs.readFileSync(sf, 'utf8');
                results.addonConfigSettingsMtime = new Date(fs.statSync(sf).mtimeMs).toISOString();
            }
        }
    } catch (e: any) {
        results.addonConfig = `ERROR: ${e.message}`;
    }

    // 5. Check /tmp/config_dir_path
    try {
        if (fs.existsSync('/tmp/config_dir_path')) {
            results.configDirPath = fs.readFileSync('/tmp/config_dir_path', 'utf8').trim();
        } else {
            results.configDirPath = '/tmp/config_dir_path NOT FOUND';
        }
    } catch (e: any) {
        results.configDirPath = `ERROR: ${e.message}`;
    }

    // 6. List top-level dirs to find any other likely mounts
    const topDirs = ['/addon_config', '/addon_configs', '/config', '/data', '/share', '/media', '/ssl', '/backup'];
    results.topLevelDirs = {};
    for (const d of topDirs) {
        try {
            if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
                results.topLevelDirs[d] = fs.readdirSync(d).slice(0, 15);
            } else {
                results.topLevelDirs[d] = 'NOT FOUND';
            }
        } catch (e: any) {
            results.topLevelDirs[d] = `ERROR: ${e.message}`;
        }
    }

    return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
