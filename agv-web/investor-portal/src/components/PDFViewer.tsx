import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractDriveFileId } from '@/lib/client-utils';

interface PDFViewerProps {
  fileUrl: string;
  title: string;
  className?: string;
}

export default function PDFViewer({ fileUrl, title, className = '' }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [processedUrl, setProcessedUrl] = useState(fileUrl);

  // Process Google Drive URLs to use service account
  useEffect(() => {
    const processUrl = async () => {
      const driveFileId = extractDriveFileId(fileUrl);

      if (driveFileId) {
        // If it's a Google Drive URL, use our API endpoint
        try {
          const response = await fetch(`/api/drive/${driveFileId}/preview`);
          if (response.ok) {
            const data = await response.json();
            setProcessedUrl(data.url);
          } else {
            console.error('Failed to get Google Drive URL:', response.statusText);
            setProcessedUrl(fileUrl); // Fallback to original URL
          }
        } catch (error) {
          console.error('Error processing Google Drive URL:', error);
          setProcessedUrl(fileUrl); // Fallback to original URL
        }
      } else {
        // Not a Google Drive URL, use as-is
        setProcessedUrl(fileUrl);
      }
    };

    processUrl();
  }, [fileUrl]);


  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={`relative w-full h-full min-h-[400px] ${className}`}>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg"
          >
            <div className="flex flex-col items-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground">Loading document...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg"
          >
            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-4 bg-muted-foreground/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">Document Preview Unavailable</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This document cannot be previewed in the browser.
              </p>
              <a
                href={processedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Download Document
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!hasError && (
        <iframe
          src={processedUrl}
          title={title}
          className="w-full h-full min-h-[400px] rounded-lg border-0"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}