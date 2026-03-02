import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    const configPath = '/config/obsidian_asteroid/settings.json';

    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            console.log('Successfully read settings.json from', configPath);
            return NextResponse.json(JSON.parse(data));
        } else {
            console.warn('settings.json not found at', configPath);
        }
    } catch (error) {
        console.error('Error reading custom settings:', error);
    }

    // Return empty object if no settings found
    return NextResponse.json({});
}
