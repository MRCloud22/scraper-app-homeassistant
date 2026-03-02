import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('API: custom-settings GET request received at', new Date().toISOString());
    const configPath = '/config/obsidian_asteroid/settings.json';
    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        path: configPath,
        exists: false,
        error: null,
        stat: null,
        rawContent: null
    };

    try {
        diagnostics.exists = fs.existsSync(configPath);
        if (diagnostics.exists) {
            diagnostics.stat = fs.statSync(configPath);
            const data = fs.readFileSync(configPath, 'utf8');
            diagnostics.rawContent = data;
            const parsed = JSON.parse(data);
            console.log('API: Successfully read and parsed settings.json');
            return NextResponse.json({
                ...parsed,
                _debug: diagnostics
            });
        } else {
            // Try to look for any files in /config just to see what's there
            try {
                diagnostics.configFiles = fs.readdirSync('/config');
            } catch (e: any) {
                diagnostics.configReadError = e.message;
            }
            console.warn('API: settings.json not found at', configPath);
        }
    } catch (error: any) {
        diagnostics.error = error.message;
        console.error('Error reading custom settings:', error);
    }

    return NextResponse.json({ _debug: diagnostics });
}
