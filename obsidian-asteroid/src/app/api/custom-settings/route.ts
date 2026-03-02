import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// All candidate paths — we pick the most recently modified one
// This lets us see definitively which mount point HA uses
const CANDIDATE_PATHS = [
    '/addon_config/settings.json',          // HA standard (singular)
    '/addon_configs/obsidian_asteroid/settings.json', // plural with slug
    '/addon_configs/settings.json',         // plural root
    '/data/settings.json',                  // HA data dir
];

export async function GET() {
    try {
        // Find all paths that exist
        const found = CANDIDATE_PATHS
            .filter(p => fs.existsSync(p))
            .map(p => ({ path: p, mtime: fs.statSync(p).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime); // newest first

        const scanned = CANDIDATE_PATHS.map(p => `${p}:${fs.existsSync(p) ? 'YES' : 'no'}`).join(' | ');

        if (found.length === 0) {
            return NextResponse.json(
                { error: 'No settings.json found', _debug: { scanned } },
                { status: 404 }
            );
        }

        // Use the most recently modified file
        const bestPath = found[0].path;
        const data = fs.readFileSync(bestPath, 'utf8');
        const parsed = JSON.parse(data);
        const mtime = new Date(found[0].mtime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return NextResponse.json({
            ...parsed,
            _debug: {
                foundPath: bestPath,
                mtime,
                allFound: found.map(f => f.path),
                scanned,
                keys: Object.keys(parsed)
            }
        });
    } catch (err: any) {
        console.error('Error reading settings:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
