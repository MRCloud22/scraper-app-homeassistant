import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Primary config location — /addon_config is the HA standard for add-on data
const SETTINGS_PATH = '/addon_config/obsidian_asteroid/settings.json';

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
