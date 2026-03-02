import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('API: custom-settings GET request received');

    // Check multiple possible configuration paths
    const pathsToTry = [
        '/addon_config/obsidian_asteroid/settings.json',
        '/config/obsidian_asteroid/settings.json',
        '/data/obsidian_asteroid/settings.json',
        '/data/settings.json',
        path.join(process.cwd(), 'public/settings.json')
    ];

    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        checkedPaths: [],
        foundPath: null,
        error: null,
        workingDir: process.cwd(),
        env: process.env.NODE_ENV
    };

    for (const configPath of pathsToTry) {
        const pathInfo: any = { path: configPath, exists: false };
        try {
            if (fs.existsSync(configPath)) {
                pathInfo.exists = true;
                const data = fs.readFileSync(configPath, 'utf8');
                const parsed = JSON.parse(data);

                diagnostics.foundPath = configPath;
                diagnostics.checkedPaths.push(pathInfo);

                return NextResponse.json({
                    ...parsed,
                    _debug: diagnostics
                });
            }
        } catch (err: any) {
            pathInfo.error = err.message;
        }
        diagnostics.checkedPaths.push(pathInfo);
    }

    // If nothing found, try to list /config if it exists
    try {
        if (fs.existsSync('/config')) diagnostics.configList = fs.readdirSync('/config');
        if (fs.existsSync('/addon_config')) diagnostics.addonConfigList = fs.readdirSync('/addon_config');
    } catch (e: any) {
        diagnostics.listError = e.message;
    }

    return NextResponse.json({ _debug: diagnostics });
}
