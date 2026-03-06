import React from 'react';
import Card from './Card';
import ImageViewer from './ImageViewer';
import VideoViewer from './VideoViewer';
import { FiImage, FiVideo, FiExternalLink } from 'react-icons/fi';

interface MediaCardProps {
  url: string;
  type: 'image' | 'video';
  className?: string;
}

export default function MediaCard({ 
  url, 
  type,
  className = '' 
}: MediaCardProps) {
  const Icon = type === 'image' ? FiImage : FiVideo;
  const Viewer = type === 'image' ? ImageViewer : VideoViewer;

  return (
    <Card className={`p-4 h-full flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
          <Icon size={20} />
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
          {type.toUpperCase()}
        </span>
      </div>
      
      {/* Media Preview */}
      <div className="mb-3 flex-grow">
        <Viewer
          fileUrl={url}
          title={`${type} media`}
          className="h-48"
        />
      </div>
      
      <div className="flex gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium text-center hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <FiExternalLink size={14} />
          View
        </a>
      </div>
    </Card>
  );
}
