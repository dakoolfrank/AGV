import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractDriveFileId } from '@/lib/client-utils';

interface VideoViewerProps {
  fileUrl: string;
  title: string;
  className?: string;
}

export default function VideoViewer({ fileUrl, title, className = '' }: VideoViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processedUrl, setProcessedUrl] = useState(fileUrl);

  // Process Google Drive URLs to use direct download
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

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  return (
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
              <p className="text-sm text-muted-foreground">Loading video...</p>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">Video Preview Unavailable</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This video cannot be previewed in the browser.
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
                View Video
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {!hasError && (
          <div className="relative group">
            <video
              src={processedUrl}
              title={title}
              className={`w-full ${className || 'h-48'} object-cover rounded-lg`}
              onLoadedData={handleLoad}
              onError={handleError}
              onPlay={handlePlay}
              onPause={handlePause}
              controls
              preload="metadata"
              crossOrigin="anonymous"
              playsInline
            />
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                <div className="bg-white/90 rounded-full p-3">
                  <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
