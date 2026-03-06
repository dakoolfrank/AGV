/**
 * Client-side utility functions
 * These functions are safe to use in the browser environment
 */

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

/**
 * Check if a URL is a Google Drive URL
 * @param url - URL to check
 * @returns true if it's a Google Drive URL
 */
export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com/.test(url);
}

/**
 * Get a direct download URL for Google Drive file (client-side)
 * This creates a direct download link without authentication
 * @param fileId - Google Drive file ID
 * @returns Direct download URL
 */
export function getDirectDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Get a preview URL for Google Drive file (client-side)
 * This creates a preview link for embedding
 * @param fileId - Google Drive file ID
 * @returns Preview URL
 */
export function getPreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
