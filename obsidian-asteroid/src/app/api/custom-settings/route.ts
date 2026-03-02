import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    const configPath = '/config/obsidian_asteroid/settings.json';

    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return NextResponse.json(JSON.parse(data));
        }
    } catch (error) {
        console.error('Error reading custom settings:', error);
    }

    // Return empty object if no settings found
    return NextResponse.json({});
}
