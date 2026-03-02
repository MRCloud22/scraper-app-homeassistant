import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    const filename = params.filename;
    const mediaPath = path.join('/config/obsidian_asteroid/media', filename);

    try {
        if (fs.existsSync(mediaPath)) {
            const fileBuffer = fs.readFileSync(mediaPath);

            // Determine content type based on extension
            const ext = path.extname(filename).toLowerCase();
            let contentType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            if (ext === '.gif') contentType = 'image/gif';
            if (ext === '.svg') contentType = 'image/svg+xml';
            if (ext === '.webp') contentType = 'image/webp';

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=3600',
                },
            });
        }
    } catch (error) {
        console.error('Error reading custom media:', error);
    }

    return new NextResponse('Not Found', { status: 404 });
}
