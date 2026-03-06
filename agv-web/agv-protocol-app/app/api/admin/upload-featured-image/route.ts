import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminStorage } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // Get and verify the Firebase ID token
    const idToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!idToken) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 });
    }

    // Verify the token and get user info
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userEmail = decodedToken.email;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin (you can implement your own admin check logic here)
    // For now, we'll allow any authenticated user to upload
    // You can add admin verification logic here if needed

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Upload to Firebase Storage using centralized adminStorage
    const fileName = `blog-featured-images/${Date.now()}-${file.name}`;
    
    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Use Admin SDK storage (bypasses security rules)
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
    const bucket = adminStorage.bucket(bucketName);
    const fileRef = bucket.file(fileName);
    
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });
    
    // Make the file publicly accessible
    await fileRef.makePublic();
    
    // Get the public URL
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    
    return NextResponse.json({ 
      success: true, 
      url: downloadURL,
      fileName: fileName 
    });

  } catch (error) {
    console.error('Error uploading featured image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' }, 
      { status: 500 }
    );
  }
}
