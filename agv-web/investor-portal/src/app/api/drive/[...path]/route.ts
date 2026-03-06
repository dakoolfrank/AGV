import { NextRequest, NextResponse } from 'next/server';
import { getDriveFileUrl, getDrivePreviewUrl, getDriveFileMetadata } from '@/lib/google-drive';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const { searchParams } = new URL(request.url);
    
    if (!path || path.length === 0) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    const fileId = path[0];
    const action = path[1] || 'preview'; // Default to preview
    const format = searchParams.get('format') || 'url';

    // Validate file ID format
    if (!/^[a-zA-Z0-9-_]+$/.test(fileId)) {
      return NextResponse.json(
        { error: 'Invalid file ID format' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'preview':
        if (format === 'metadata') {
          result = await getDriveFileMetadata(fileId);
        } else {
          result = { url: await getDrivePreviewUrl(fileId) };
        }
        break;
      
      case 'download':
        result = { url: await getDriveFileUrl(fileId) };
        break;
      
      case 'metadata':
        result = await getDriveFileMetadata(fileId);
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: preview, download, or metadata' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Google Drive API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to access Google Drive file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle POST requests for batch operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileIds, action = 'preview' } = body;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'fileIds array is required' },
        { status: 400 }
      );
    }

    const successful: unknown[] = [];
    const failed: { fileId: string; error: string }[] = [];

    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i];
      try {
        let result;
        switch (action) {
          case 'preview':
            result = { fileId, url: await getDrivePreviewUrl(fileId) };
            break;
          case 'download':
            result = { fileId, url: await getDriveFileUrl(fileId) };
            break;
          case 'metadata':
            const metadata = await getDriveFileMetadata(fileId);
            result = { fileId, ...metadata };
            break;
          default:
            throw new Error('Invalid action');
        }
        successful.push(result);
      } catch (error) {
        failed.push({
          fileId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      successful,
      failed,
      total: fileIds.length,
      successCount: successful.length,
      failureCount: failed.length
    });
  } catch (error) {
    console.error('Google Drive batch API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process batch request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
