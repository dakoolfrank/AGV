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

/**
 * Get a direct download URL for a Google Drive file
 * @param fileId - The Google Drive file ID
 * @returns Direct download URL
 */
export async function getDriveFileUrl(fileId: string): Promise<string> {
  try {
    // Get file metadata to check if it exists and get the name
    await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,webViewLink',
    });

    // Generate a direct download URL
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    return downloadUrl;
  } catch (error) {
    console.error('Error getting Google Drive file URL:', error);
    throw new Error(`Failed to access Google Drive file: ${fileId}`);
  }
}

/**
 * Get a preview URL for a Google Drive file (for embedding)
 * @param fileId - The Google Drive file ID
 * @returns Preview URL for embedding
 */
export async function getDrivePreviewUrl(fileId: string): Promise<string> {
  try {
    // Get file metadata
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,webViewLink',
    });

    // For PDFs, use the embed URL
    if (fileMetadata.data.mimeType === 'application/pdf') {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }

    // For other file types, use the web view link
    return fileMetadata.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  } catch (error) {
    console.error('Error getting Google Drive preview URL:', error);
    throw new Error(`Failed to access Google Drive file: ${fileId}`);
  }
}

/**
 * Get file metadata from Google Drive
 * @param fileId - The Google Drive file ID
 * @returns File metadata
 */
export async function getDriveFileMetadata(fileId: string) {
  try {
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink',
    });

    return fileMetadata.data;
  } catch (error) {
    console.error('Error getting Google Drive file metadata:', error);
    throw new Error(`Failed to get metadata for Google Drive file: ${fileId}`);
  }
}

/**
 * List files in a Google Drive folder
 * @param folderId - The Google Drive folder ID
 * @returns Array of file metadata
 */
export async function listDriveFolderFiles(folderId: string) {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)',
      orderBy: 'name',
    });

    return response.data.files || [];
  } catch (error) {
    console.error('Error listing Google Drive folder files:', error);
    throw new Error(`Failed to list files in Google Drive folder: ${folderId}`);
  }
}

/**
 * Extract file ID from Google Drive URL
 * @param url - Google Drive URL
 * @returns File ID or null if not found
 */
export function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
