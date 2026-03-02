import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Config is at /config/obsidian_asteroid/ — mapped via "map: config:rw"
const CONFIG_DIR = '/config/obsidian_asteroid';
const SETTINGS_PATH = path.join(CONFIG_DIR, 'settings.json');

export async function GET() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
            const parsed = JSON.parse(data);
            const stat = fs.statSync(SETTINGS_PATH);
            const mtime = new Date(stat.mtimeMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return NextResponse.json({
                ...parsed,
                _debug: {
                    foundPath: SETTINGS_PATH,
                    mtime,
                    keys: Object.keys(parsed)
                }
            });
        }

        return NextResponse.json(
            { error: 'Settings not found', _debug: { checkedPath: SETTINGS_PATH } },
            { status: 404 }
        );
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
