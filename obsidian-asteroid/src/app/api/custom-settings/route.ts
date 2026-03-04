import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = '/config/obsidian_asteroid/settings.json';

export async function GET() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
            const parsed = JSON.parse(data);
            return NextResponse.json(parsed);
        }

        return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}
