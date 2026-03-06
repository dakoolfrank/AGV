import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const folder = formData.get('folder') as string;
    const applicationId = formData.get('applicationId') as string;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder path is required' },
        { status: 400 }
      );
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ;
    const bucket = adminStorage.bucket(bucketName);
    const uploadedFiles = [];

    for (const file of files) {
      // Validate file size (20MB limit)
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} is too large. Maximum size is 20MB.` },
          { status: 400 }
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = applicationId 
        ? `${folder}/${applicationId}/${fileName}`
        : `${folder}/${fileName}`;

      // Upload file to Firebase Storage
      const fileBuffer = await file.arrayBuffer();
      const fileUpload = bucket.file(filePath);
      
      await fileUpload.save(Buffer.from(fileBuffer), {
        metadata: {
          contentType: file.type,
          metadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Make file publicly accessible
      await fileUpload.makePublic();

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      uploadedFiles.push({
        name: file.name,
        url: publicUrl,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    });

  } catch (error) {
    console.error('Error uploading files:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { fileUrls } = await request.json();

    if (!fileUrls || !Array.isArray(fileUrls)) {
      return NextResponse.json(
        { error: 'File URLs array is required' },
        { status: 400 }
      );
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ;
    const bucket = adminStorage.bucket(bucketName);
    const deletePromises = fileUrls.map(async (url: string) => {
      try {
        // Extract file path from URL
        const urlParts = url.split('/');
        const filePath = urlParts.slice(4).join('/'); // Remove protocol and domain parts
        
        const file = bucket.file(filePath);
        await file.delete();
      } catch (error) {
        console.warn('Failed to delete file:', url, error);
        // Don't throw error for individual file deletion failures
      }
    });

    await Promise.all(deletePromises);

    return NextResponse.json({
      success: true,
      message: 'Files deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting files:', error);
    return NextResponse.json(
      { error: 'Failed to delete files' },
      { status: 500 }
    );
  }
}
