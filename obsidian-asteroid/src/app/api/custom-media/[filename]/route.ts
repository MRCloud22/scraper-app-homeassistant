import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
    return [];
}

// Discover the config directory — run.sh writes the path to /tmp/config_dir_path
function getMediaDir(): string {
    try {
        if (fs.existsSync('/tmp/config_dir_path')) {
            const configDir = fs.readFileSync('/tmp/config_dir_path', 'utf8').trim();
            return path.join(configDir, 'media');
        }
    } catch { }

    // Fallback: scan for the directory ourselves
    const base = '/config/addons_config';
    if (fs.existsSync(base)) {
        const dirs = fs.readdirSync(base).filter(d =>
            d.endsWith('_obsidian_asteroid') && fs.statSync(path.join(base, d)).isDirectory()
        );
        if (dirs.length > 0) return path.join(base, dirs[0], 'media');
    }

    return '/addon_config/media'; // last resort fallback
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    const { filename } = await context.params;

    // Prevent path traversal attacks
    const safeName = path.basename(filename);
    const mediaDir = getMediaDir();
    const mediaPath = path.join(mediaDir, safeName);

    try {
        if (fs.existsSync(mediaPath)) {
            const fileBuffer = fs.readFileSync(mediaPath);

            const ext = path.extname(safeName).toLowerCase();
            let contentType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            if (ext === '.gif') contentType = 'image/gif';
            if (ext === '.svg') contentType = 'image/svg+xml';
            if (ext === '.webp') contentType = 'image/webp';

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache, must-revalidate',
                },
            });
        }
    } catch (error) {
        console.error('Error reading custom media:', error);
    }

    return new NextResponse('Not Found', { status: 404 });
}
