import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
    return [];
}

// Config is at /config/obsidian_asteroid/ — mapped via "map: config:rw"
const MEDIA_DIR = '/config/obsidian_asteroid/media';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    const { filename } = await context.params;

    // Prevent path traversal attacks
    const safeName = path.basename(filename);
    const mediaPath = path.join(MEDIA_DIR, safeName);

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
