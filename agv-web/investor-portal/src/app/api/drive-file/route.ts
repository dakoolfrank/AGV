import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Initialize Google Drive API with service account
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
  },
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');
    const range = request.headers.get('range');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    console.log('Fetching file:', fileId, 'Range:', range);

    // Get file metadata
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size',
    });

    console.log('File metadata:', fileMetadata.data);

    const mimeType = fileMetadata.data.mimeType || 'application/octet-stream';
    const fileSize = parseInt(fileMetadata.data.size || '0');

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Accept-Ranges': 'bytes',
    };

    // Handle range requests for video streaming
    if (range) {
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
        
        // Ensure end doesn't exceed file size
        const actualEnd = Math.min(end, fileSize - 1);
        const contentLength = actualEnd - start + 1;

        console.log(`Range request: ${start}-${actualEnd} of ${fileSize}`);

        // Get file content with range
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, {
          responseType: 'arraybuffer',
          headers: {
            Range: `bytes=${start}-${actualEnd}`,
          },
        });

        const buffer = Buffer.from(response.data as ArrayBuffer);

        headers['Content-Range'] = `bytes ${start}-${actualEnd}/${fileSize}`;
        headers['Content-Length'] = contentLength.toString();

        return new NextResponse(buffer, {
          status: 206, // Partial Content
          headers,
        });
      }
    }

    // Get full file content
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data as ArrayBuffer);

    console.log('File size:', buffer.length, 'MIME type:', mimeType);

    headers['Content-Length'] = buffer.length.toString();

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Drive file error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle HEAD requests for video metadata
export async function HEAD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return new NextResponse(null, { status: 400 });
    }

    // Get file metadata
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size',
    });

    const mimeType = fileMetadata.data.mimeType || 'application/octet-stream';
    const fileSize = parseInt(fileMetadata.data.size || '0');

    const headers: Record<string, string> = {
      'Content-Type': mimeType,
      'Content-Length': fileSize.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
    };

    return new NextResponse(null, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Drive file HEAD error:', error);
    return new NextResponse(null, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  });
}