import React from 'react';
import Card from './Card';
import { FiFileText, FiExternalLink } from 'react-icons/fi';

interface DocumentCardProps {
  title: string;
  description: string;
  url: string;
  type?: string;
  className?: string;
}

export default function DocumentCard({ 
  title, 
  description, 
  url, 
  type = 'PDF',
  className = '' 
}: DocumentCardProps) {
  return (
    <Card className={`p-6 h-full flex flex-col ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
          <FiFileText size={24} />
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
          {type}
        </span>
      </div>
      
      <h3 className="text-lg font-semibold mb-2 line-clamp-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-4 flex-grow line-clamp-3">{description}</p>
      
      <div className="flex gap-2 mt-auto">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium text-center hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <FiExternalLink size={16} />
          View
        </a>
      </div>
    </Card>
  );
}
