import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// /addon_config is already the addon-specific directory in HA
// (mapped from addon_configs/HASH_slug/ on the host — no subdirectory needed)
const SETTINGS_PATH = '/addon_config/settings.json';

export async function GET() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
            const parsed = JSON.parse(data);
            // Return parsed settings + debug info so the UI knows what file was read
            return NextResponse.json({
                ...parsed,
                _debug: { foundPath: SETTINGS_PATH, keys: Object.keys(parsed) }
            });
        }

        return NextResponse.json(
            { error: 'Settings not found', _debug: { checkedPath: SETTINGS_PATH } },
            { status: 404 }
        );
    } catch (err: any) {
        console.error('Error reading settings:', err);
        return NextResponse.json(
            { error: err.message, _debug: { checkedPath: SETTINGS_PATH } },
            { status: 500 }
        );
    }
}
