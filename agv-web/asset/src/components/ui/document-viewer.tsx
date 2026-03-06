"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  FileText,
  Download,
  Eye,
  X,
} from "lucide-react";

interface DocumentViewerProps {
  document: {
    name: string;
    url: string;
    size: number;
    type: string;
    uploadedAt: string;
    field: string;
  };
  showDetails?: boolean;
  variant?: "button" | "card";
}

export function DocumentViewer({ 
  document, 
  showDetails = true, 
  variant = "button" 
}: DocumentViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    return '📁';
  };

  const isViewableInBrowser = (type: string) => {
    return type.includes('pdf') || 
           type.includes('image') || 
           type.includes('text') ||
           type.includes('html');
  };

  if (variant === "card") {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="text-2xl">{getFileIcon(document.type)}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {document.name}
                </p>
                {showDetails && (
                  <p className="text-sm text-gray-500">
                    {document.field} • {formatFileSize(document.size)} • {formatDate(document.uploadedAt)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
              >
                <a href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View
                </a>
              </Button>
              {isViewableInBrowser(document.type) && (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center">
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                    <DialogHeader>
                      <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center">
                          <FileText className="mr-2 h-5 w-5" />
                          {document.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsOpen(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto">
                      {document.type.includes('pdf') ? (
                        <iframe
                          src={document.url}
                          className="w-full h-[60vh] border-0"
                          title={document.name}
                        />
                      ) : document.type.includes('image') ? (
                        <img
                          src={document.url}
                          alt={document.name}
                          className="max-w-full h-auto mx-auto"
                        />
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500 mb-4">Preview not available for this file type.</p>
                          <Button asChild>
                            <a href={document.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open in New Tab
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="outline"
        size="sm"
        asChild
        className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
      >
        <a href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-center">
          <ExternalLink className="mr-2 h-4 w-4" />
          View Document
        </a>
      </Button>
      {isViewableInBrowser(document.type) && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  {document.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {document.type.includes('pdf') ? (
                <iframe
                  src={document.url}
                  className="w-full h-[60vh] border-0"
                  title={document.name}
                />
              ) : document.type.includes('image') ? (
                <img
                  src={document.url}
                  alt={document.name}
                  className="max-w-full h-auto mx-auto"
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Preview not available for this file type.</p>
                  <Button asChild>
                    <a href={document.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
