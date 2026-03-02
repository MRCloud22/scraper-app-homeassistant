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
            return NextResponse.json(parsed);
        }

        // Settings not yet created (first boot before run.sh finished)
        return NextResponse.json(
            { error: 'Settings not found', path: SETTINGS_PATH },
            { status: 404 }
        );
    } catch (err: any) {
        console.error('Error reading settings:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
