import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { InstitutionalApplication } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const applicationData = JSON.parse(formData.get('applicationData') as string);
    const files = formData.getAll('files') as File[];
    
    // Validate required fields
    if (!applicationData.organizationProfile?.legalEntityName || 
        !applicationData.organizationProfile?.jurisdiction || 
        !applicationData.organizationProfile?.registrationNumber || 
        !applicationData.organizationProfile?.registeredAddress || 
        !applicationData.organizationProfile?.organizationType) {
      return NextResponse.json(
        { error: 'Missing required organization profile fields' },
        { status: 400 }
      );
    }

    if (!applicationData.contacts?.primary?.name || 
        !applicationData.contacts?.primary?.title || 
        !applicationData.contacts?.primary?.email) {
      return NextResponse.json(
        { error: 'Missing required contact fields' },
        { status: 400 }
      );
    }

    // Create application first to get ID
    const docRef = await adminDb.collection('institutional_applications').add({
      ...applicationData,
      attachments: {}, // Will be populated after file upload
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'new'
    });

    // Upload files if any
    let uploadedFiles: any[] = [];
    if (files && files.length > 0) {
      const uploadPromises = files.map(async (file) => {
        // Validate file size (20MB limit)
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Maximum size is 20MB.`);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const filePath = `institutional_applications/${docRef.id}/${fileName}`;

        // Upload to Firebase Storage using Admin SDK
        const { adminStorage } = await import('@/lib/firebase-admin');
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ;
        console.log("bucketName", bucketName);
        const bucket = adminStorage.bucket(bucketName);
        
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

        return {
          name: file.name,
          url: publicUrl,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        };
      });

      uploadedFiles = await Promise.all(uploadPromises);

      // Update application with file URLs
      await docRef.update({
        attachments: {
          regulatoryDocuments: uploadedFiles,
        },
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      uploadedFiles: uploadedFiles.length
    });

  } catch (error) {
    console.error('Error creating institutional application:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create application' },
      { status: 500 }
    );
  }
}
