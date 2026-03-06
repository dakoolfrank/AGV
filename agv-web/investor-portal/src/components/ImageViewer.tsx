import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { extractDriveFileId } from '@/lib/client-utils';

interface ImageViewerProps {
  fileUrl: string;
  title: string;
  className?: string;
}

export default function ImageViewer({ fileUrl, title, className = '' }: ImageViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [processedUrl, setProcessedUrl] = useState(fileUrl);

  // Process Google Drive URLs to use our proxy endpoint
  useEffect(() => {
    const processUrl = async () => {
      const driveFileId = extractDriveFileId(fileUrl);
      
      if (driveFileId) {
        // If it's a Google Drive URL, use our proxy endpoint
        setProcessedUrl(`/api/drive-file?id=${driveFileId}`);
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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
      <div className={`relative w-full ${className || 'h-48'}`}>
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Loading image...</p>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Image Preview Unavailable</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This image cannot be previewed in the browser.
                </p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Image
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!hasError && (
          <div className="relative group">
            <Image
              src={processedUrl}
              alt={title}
              width={800}
              height={600}
              className={`w-full ${className || 'h-48'} object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
              onLoad={handleLoad}
              onError={handleError}
              onClick={toggleFullscreen}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="bg-white/90 rounded-full p-2">
                <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={toggleFullscreen}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-7xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={processedUrl}
                alt={title}
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <button
                onClick={toggleFullscreen}
                className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
