import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { Query, CollectionReference } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Handle file uploads to Firebase Storage and save URLs to Firestore
    const formData = await request.formData();
    
    // Extract form data
    const basicData = JSON.parse(formData.get('basicData') as string);
    const financialData = JSON.parse(formData.get('financialData') as string);
    const operationsCompliance = JSON.parse(formData.get('operationsCompliance') as string);
    const tierData = JSON.parse(formData.get('tierData') as string);
    
    // Validate required fields
    if (!basicData || !financialData || !operationsCompliance || !tierData) {
      return NextResponse.json(
        { error: 'Missing required form data' },
        { status: 400 }
      );
    }

    // Create application first to get ID for file organization
    const assetSubmission = {
      basicData,
      financialData,
      operationsCompliance,
      tierData,
      submittedAt: new Date(),
      status: 'pending',
      attachments: {}, // Will be populated after file upload
    };

    const docRef = await adminDb.collection('asset_submissions').add(assetSubmission);

    // Upload files and get URLs
    const uploadedFiles: Array<{
      name: string;
      url: string;
      size: number;
      type: string;
      uploadedAt: string;
      field: string;
    }> = [];

    // Get Firebase Storage bucket
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = adminStorage.bucket(bucketName);
    
    // Upload other subsidies file
    const otherSubsidiesFile = formData.get('otherSubsidiesFile') as File;
    if (otherSubsidiesFile && otherSubsidiesFile.size > 0) {
      // Validate file size (20MB limit)
      if (otherSubsidiesFile.size > 20 * 1024 * 1024) {
        throw new Error(`File ${otherSubsidiesFile.name} is too large. Maximum size is 20MB.`);
      }

      const timestamp = Date.now();
      const fileName = `${timestamp}_${otherSubsidiesFile.name}`;
      const filePath = `asset_submissions/${docRef.id}/${fileName}`;
      
      const fileBuffer = await otherSubsidiesFile.arrayBuffer();
      const fileUpload = bucket.file(filePath);
      
      await fileUpload.save(Buffer.from(fileBuffer), {
        metadata: {
          contentType: otherSubsidiesFile.type,
          metadata: {
            originalName: otherSubsidiesFile.name,
            uploadedAt: new Date().toISOString(),
            field: 'otherSubsidiesFile',
          },
        },
      });

      // Make file publicly accessible
      await fileUpload.makePublic();

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      uploadedFiles.push({
        name: otherSubsidiesFile.name,
        url: publicUrl,
        size: otherSubsidiesFile.size,
        type: otherSubsidiesFile.type,
        uploadedAt: new Date().toISOString(),
        field: 'otherSubsidiesFile',
      });
    }
    
    // Upload orchard product sales revenue file
    const orchardProductSalesRevenueFile = formData.get('orchardProductSalesRevenueFile') as File;
    if (orchardProductSalesRevenueFile && orchardProductSalesRevenueFile.size > 0) {
      // Validate file size (20MB limit)
      if (orchardProductSalesRevenueFile.size > 20 * 1024 * 1024) {
        throw new Error(`File ${orchardProductSalesRevenueFile.name} is too large. Maximum size is 20MB.`);
      }

      const timestamp = Date.now();
      const fileName = `${timestamp}_${orchardProductSalesRevenueFile.name}`;
      const filePath = `asset_submissions/${docRef.id}/${fileName}`;
      
      const fileBuffer = await orchardProductSalesRevenueFile.arrayBuffer();
      const fileUpload = bucket.file(filePath);
      
      await fileUpload.save(Buffer.from(fileBuffer), {
        metadata: {
          contentType: orchardProductSalesRevenueFile.type,
          metadata: {
            originalName: orchardProductSalesRevenueFile.name,
            uploadedAt: new Date().toISOString(),
            field: 'orchardProductSalesRevenueFile',
          },
        },
      });

      // Make file publicly accessible
      await fileUpload.makePublic();

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      uploadedFiles.push({
        name: orchardProductSalesRevenueFile.name,
        url: publicUrl,
        size: orchardProductSalesRevenueFile.size,
        type: orchardProductSalesRevenueFile.type,
        uploadedAt: new Date().toISOString(),
        field: 'orchardProductSalesRevenueFile',
      });
    }
    
    // Upload solar electricity sales revenue file
    const solarElectricitySalesRevenueFile = formData.get('solarElectricitySalesRevenueFile') as File;
    if (solarElectricitySalesRevenueFile && solarElectricitySalesRevenueFile.size > 0) {
      // Validate file size (20MB limit)
      if (solarElectricitySalesRevenueFile.size > 20 * 1024 * 1024) {
        throw new Error(`File ${solarElectricitySalesRevenueFile.name} is too large. Maximum size is 20MB.`);
      }

      const timestamp = Date.now();
      const fileName = `${timestamp}_${solarElectricitySalesRevenueFile.name}`;
      const filePath = `asset_submissions/${docRef.id}/${fileName}`;
      
      const fileBuffer = await solarElectricitySalesRevenueFile.arrayBuffer();
      const fileUpload = bucket.file(filePath);
      
      await fileUpload.save(Buffer.from(fileBuffer), {
        metadata: {
          contentType: solarElectricitySalesRevenueFile.type,
          metadata: {
            originalName: solarElectricitySalesRevenueFile.name,
            uploadedAt: new Date().toISOString(),
            field: 'solarElectricitySalesRevenueFile',
          },
        },
      });

      // Make file publicly accessible
      await fileUpload.makePublic();

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      uploadedFiles.push({
        name: solarElectricitySalesRevenueFile.name,
        url: publicUrl,
        size: solarElectricitySalesRevenueFile.size,
        type: solarElectricitySalesRevenueFile.type,
        uploadedAt: new Date().toISOString(),
        field: 'solarElectricitySalesRevenueFile',
      });
    }

    // Update the document with file URLs and attachments
    const fileUrls: { [key: string]: string } = {};
    uploadedFiles.forEach(file => {
      fileUrls[`${file.field}Url`] = file.url;
    });

    await docRef.update({
      financialData: {
        ...financialData,
        ...fileUrls
      },
      tierData: {
        ...tierData,
        ...fileUrls
      },
      attachments: {
        files: uploadedFiles,
      },
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Asset registration submitted successfully',
      uploadedFiles: uploadedFiles.length,
      fileUrls
    });
  } catch (error) {
    console.error('Error submitting asset registration:', error);
    return NextResponse.json(
      { error: 'Failed to submit asset registration' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if the requester is authorized for admin access
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let query: CollectionReference | Query = adminDb.collection('asset_submissions');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.orderBy('submittedAt', 'desc').get();
    const assets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({ assets });
  } catch (error) {
    console.error('Error fetching asset submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset submissions' },
      { status: 500 }
    );
  }
}
