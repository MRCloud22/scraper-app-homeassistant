import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';

export const dynamic = 'force-dynamic';

// Debug endpoint: scans the container filesystem to find ALL settings.json files
// and lists the contents of likely config directories
export async function GET() {
    const results: Record<string, any> = {};

    // 1. Find all settings.json files in the container (excluding /proc, /sys, /app)
    try {
        const found = execSync(
            'find / -name "settings.json" -type f -not -path "/proc/*" -not -path "/sys/*" -not -path "/app/.next/*" 2>/dev/null',
            { timeout: 5000 }
        ).toString().trim();
        results.settingsJsonFiles = found ? found.split('\n') : [];
    } catch (e: any) {
        results.settingsJsonFiles = `ERROR: ${e.message}`;
    }

    // 2. List contents of all likely config directories
    const dirsToList = [
        '/addon_config',
        '/addon_configs',
        '/data',
        '/config',
        '/share',
        '/homeassistant',
    ];

    results.directories = {};
    for (const dir of dirsToList) {
        try {
            if (fs.existsSync(dir)) {
                const items = fs.readdirSync(dir);
                results.directories[dir] = items;
            } else {
                results.directories[dir] = 'NOT FOUND';
            }
        } catch (e: any) {
            results.directories[dir] = `ERROR: ${e.message}`;
        }
    }

    // 3. Read current content of /addon_config/settings.json if it exists
    try {
        if (fs.existsSync('/addon_config/settings.json')) {
            const stat = fs.statSync('/addon_config/settings.json');
            results.addonConfigContent = {
                content: fs.readFileSync('/addon_config/settings.json', 'utf8'),
                mtime: new Date(stat.mtimeMs).toISOString(),
                size: stat.size,
            };
        }
    } catch (e: any) {
        results.addonConfigContent = `ERROR: ${e.message}`;
    }

    return NextResponse.json(results, {
        headers: { 'Cache-Control': 'no-store' }
    });
}
