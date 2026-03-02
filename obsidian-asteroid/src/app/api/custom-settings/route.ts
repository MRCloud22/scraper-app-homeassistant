import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Discover the config directory — run.sh writes the path to /tmp/config_dir_path
function getConfigDir(): string {
    try {
        if (fs.existsSync('/tmp/config_dir_path')) {
            return fs.readFileSync('/tmp/config_dir_path', 'utf8').trim();
        }
    } catch { }

    // Fallback: scan for the directory ourselves
    const base = '/config/addons_config';
    if (fs.existsSync(base)) {
        const dirs = fs.readdirSync(base).filter(d =>
            d.endsWith('_obsidian_asteroid') && fs.statSync(path.join(base, d)).isDirectory()
        );
        if (dirs.length > 0) return path.join(base, dirs[0]);
    }

    return '/addon_config'; // last resort fallback
}

export async function GET() {
    try {
        const configDir = getConfigDir();
        const settingsPath = path.join(configDir, 'settings.json');

        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            const parsed = JSON.parse(data);
            const stat = fs.statSync(settingsPath);
            const mtime = new Date(stat.mtimeMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return NextResponse.json({
                ...parsed,
                _debug: {
                    foundPath: settingsPath,
                    configDir,
                    mtime,
                    keys: Object.keys(parsed)
                }
            });
        }

        return NextResponse.json(
            { error: 'Settings not found', _debug: { checkedPath: settingsPath, configDir } },
            { status: 404 }
        );
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
