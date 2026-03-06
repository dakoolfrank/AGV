"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LinkModal } from './link-modal';
// Removed Firebase client imports - now using API endpoint
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Quote, 
  Link as LinkIcon, 
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react';

interface MediumEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export function MediumEditor({ content, onChange, placeholder = "Start writing...", className = "" }: MediumEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content && !isTyping) {
      // Only update if not currently typing
      editorRef.current.innerHTML = content;
    }
  }, [content, isTyping]);

  const handleInput = () => {
    if (editorRef.current) {
      setIsTyping(true);
      // Use a timeout to ensure DOM has updated
      setTimeout(() => {
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
          // Reset typing flag after a short delay
          setTimeout(() => setIsTyping(false), 100);
        }
      }, 0);
    }
  };

  const execCommand = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      try {
        const success = document.execCommand(command, false, value);
        if (success) {
          handleInput();
        }
      } catch (error) {
        console.error('Error executing command:', error);
        // Fallback: try to apply formatting manually
        if (command === 'bold' || command === 'italic' || command === 'underline') {
          formatText(command);
        }
      }
    }
  };

  const formatText = (format: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    console.log('Formatting text with:', format);
    
    // Try execCommand first - this is the most reliable method
    try {
      const success = document.execCommand(format, false);
      console.log('execCommand result:', success);
      if (success) {
        // Force a re-render and update
        handleInput();
        // Also try to trigger a change event
        if (editorRef.current) {
          editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
        console.log('execCommand completed, content:', editorRef.current?.innerHTML);
        return;
      }
    } catch (error) {
      console.error('execCommand error:', error);
    }
    
    // If execCommand failed, try manual approach
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.log('No selection available');
      return;
    }
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    console.log('Selected text:', selectedText);
    
    if (!selectedText) {
      console.log('No text selected, cannot format');
      return;
    }
    
    // Manual formatting: replace selected text with formatted version
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `<strong>${selectedText}</strong>`;
        break;
      case 'italic':
        formattedText = `<em>${selectedText}</em>`;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        break;
      default:
        return;
    }
    
    try {
      // Replace the selected text with formatted version
      range.deleteContents();
      
      // Create a temporary div to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formattedText;
      
      // Insert the formatted content
      const fragment = document.createDocumentFragment();
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
      range.insertNode(fragment);
      
      // Place cursor after the formatted text
      const newRange = document.createRange();
      newRange.setStartAfter(fragment.lastChild || fragment);
      newRange.setEndAfter(fragment.lastChild || fragment);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      handleInput();
      console.log('Manual formatting completed');
    } catch (error) {
      console.error('Error in manual formatting:', error);
    }
  };

  const uploadAndInsertImage = async (file: File) => {
    console.log('Starting image upload for:', file.name);
    setIsUploading(true);
    try {
      // Upload via API endpoint (like g3_funding)
      const formData = new FormData();
      formData.append('file', file);
      
      // Get auth token
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) {
        alert('Please log in to upload images.');
        return;
      }
      
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/admin/upload-featured-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      const imageUrl = result.url;
      console.log('Uploaded image URL:', imageUrl);
      
        // Insert image at cursor position or at the end
        const selection = window.getSelection();
        let range: Range;
        
        if (selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
        console.log('Using existing selection');
        } else {
          // If no selection, insert at the end
          range = document.createRange();
          if (editorRef.current) {
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
          console.log('Created new range at end of editor');
        }
        }
        
        const img = document.createElement('img');
      img.src = imageUrl;
        img.alt = 'Uploaded image';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '20px auto';
        img.className = 'medium-image';
        
      console.log('Inserting image element:', img);
        range.deleteContents();
        range.insertNode(img);
      console.log('Image inserted successfully');
      
      // Set cursor position after the inserted image
      try {
        const newRange = document.createRange();
        if (img && img.parentNode) {
          newRange.setStartAfter(img);
          newRange.setEndAfter(img);
          const currentSelection = window.getSelection();
          if (currentSelection) {
            currentSelection.removeAllRanges();
            currentSelection.addRange(newRange);
          }
        }
      } catch (error) {
        console.error('Error setting cursor position:', error);
        // Fallback: just place cursor at the end of the editor
        if (editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        }
      }
      
      handleInput();
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsUploading(false);
    }
  };

  const insertImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    console.log('File selected:', file.name, file.type);
    await uploadAndInsertImage(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    for (const file of imageFiles) {
      await uploadAndInsertImage(file);
    }
  };


  const insertLink = () => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const text = range.toString();
      setSelectedText(text);
    } else {
      setSelectedText('');
    }
    setShowLinkModal(true);
  };

  const handleLinkInsert = (url: string, text: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    console.log('Inserting link:', url, 'with text:', text);
    
    // Try execCommand first - this is the most reliable method
    try {
      const success = document.execCommand('createLink', false, url);
      console.log('execCommand createLink result:', success);
      
      if (success) {
        // If we have custom text, replace the link text
        if (text && text !== url) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const linkElement = range.commonAncestorContainer.parentElement?.closest('a');
            if (linkElement) {
              linkElement.textContent = text;
            }
          }
        }
        handleInput();
        return;
      }
    } catch (error) {
      console.error('execCommand createLink error:', error);
    }
    
    // Manual link insertion
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.log('No selection available for link insertion');
      return;
    }
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    console.log('Selected text for link:', selectedText);
    
    const linkText = text || selectedText || url;
    
    try {
      // Create the link element
      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.target = '_blank';
      linkElement.rel = 'noopener noreferrer';
      linkElement.textContent = linkText;
      
      // Replace selected text with link or insert at cursor
      range.deleteContents();
      range.insertNode(linkElement);
      
      // Place cursor after the link
      const newRange = document.createRange();
      newRange.setStartAfter(linkElement);
      newRange.setEndAfter(linkElement);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      handleInput();
      console.log('Link inserted successfully, content:', editorRef.current?.innerHTML);
    } catch (error) {
      console.error('Error in manual link insertion:', error);
    }
  };

  const insertHeading = (level: number) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const heading = document.createElement(`h${level}`);
      heading.textContent = selection.toString() || `Heading ${level}`;
      range.deleteContents();
      range.insertNode(heading);
      
      // Set cursor position after the inserted heading
      try {
        const newRange = document.createRange();
        if (heading && heading.parentNode) {
          newRange.setStartAfter(heading);
          newRange.setEndAfter(heading);
          const currentSelection = window.getSelection();
          if (currentSelection) {
            currentSelection.removeAllRanges();
            currentSelection.addRange(newRange);
          }
        }
      } catch (error) {
        console.error('Error setting cursor position:', error);
        // Fallback: just place cursor at the end of the editor
        if (editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const selection = window.getSelection();
          if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
          }
        }
      }
      handleInput();
    }
  };

  const insertQuote = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const blockquote = document.createElement('blockquote');
      blockquote.textContent = selection.toString() || 'Quote';
      blockquote.style.borderLeft = '4px solid #ccc';
      blockquote.style.paddingLeft = '20px';
      blockquote.style.margin = '20px 0';
      blockquote.style.fontStyle = 'italic';
      range.deleteContents();
      range.insertNode(blockquote);
      
      // Set cursor position after the inserted quote
      try {
        const newRange = document.createRange();
        if (blockquote && blockquote.parentNode) {
          newRange.setStartAfter(blockquote);
          newRange.setEndAfter(blockquote);
          const currentSelection = window.getSelection();
          if (currentSelection) {
            currentSelection.removeAllRanges();
            currentSelection.addRange(newRange);
          }
        }
      } catch (error) {
        console.error('Error setting cursor position:', error);
        // Fallback: just place cursor at the end of the editor
        if (editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const selection = window.getSelection();
          if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
          }
        }
      }
      handleInput();
    }
  };

  return (
    <div className={`medium-editor ${className}`}>
        
        {/* Link Modal */}
      <LinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onInsert={handleLinkInsert}
        selectedText={selectedText}
      />
      
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border border-gray-200 rounded-t-lg bg-gray-50 sticky top-0 z-10">
        {/* Text Formatting */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('bold')}
            className="h-8 w-8 p-0"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('italic')}
            className="h-8 w-8 p-0"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('underline')}
            className="h-8 w-8 p-0"
            title="Underline"
          >
            <Underline className="w-4 h-4" />
          </Button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(1)}
            className="h-8 w-8 p-0"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(2)}
            className="h-8 w-8 p-0"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(3)}
            className="h-8 w-8 p-0"
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </Button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => execCommand('insertUnorderedList')}
            className="h-8 w-8 p-0"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => execCommand('insertOrderedList')}
            className="h-8 w-8 p-0"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => execCommand('justifyLeft')}
            className="h-8 w-8 p-0"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => execCommand('justifyCenter')}
            className="h-8 w-8 p-0"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => execCommand('justifyRight')}
            className="h-8 w-8 p-0"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Quote */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertQuote}
            className="h-8 w-8 p-0"
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </Button>
        </div>

        {/* Link */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertLink}
            className="h-8 w-8 p-0"
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Image Upload */}
        <div className="flex items-center gap-1">
          <input
            type="file"
            accept="image/*"
            onChange={insertImage}
            className="hidden"
            id="image-upload"
            disabled={isUploading}
            multiple={false}
          />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Insert Image"
              disabled={isUploading}
            onClick={() => {
              const input = document.getElementById('image-upload') as HTMLInputElement;
              if (input) {
                input.click();
              }
            }}
            >
              {isUploading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </Button>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        dir="ltr"
        onInput={handleInput}
        onKeyDown={() => setIsTyping(true)}
        onKeyUp={handleInput}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`min-h-[400px] p-4 border border-gray-200 border-t-0 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-blue-500 relative ${
          isDragging ? 'border-blue-500 bg-blue-50' : ''
        }`}
        style={{
          lineHeight: '1.6',
          fontSize: '16px',
          // Ensure formatting is visible
          fontFamily: 'inherit',
          // Fix text direction
          direction: 'ltr',
          textAlign: 'left',
          unicodeBidi: 'normal'
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-500 rounded-lg z-10">
            <div className="text-center">
              <ImageIcon className="w-12 h-12 text-blue-500 mx-auto mb-2" />
              <p className="text-blue-600 font-medium">Drop images here to upload</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .medium-editor [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #999;
          font-style: italic;
        }
        
        .medium-editor .medium-image {
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .medium-editor blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 20px;
          margin: 20px 0;
          font-style: italic;
          color: #6b7280;
        }
        
        .medium-editor h1 {
          font-size: 2rem;
          font-weight: bold;
          margin: 24px 0 16px 0;
          line-height: 1.2;
        }
        
        .medium-editor h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 20px 0 12px 0;
          line-height: 1.3;
        }
        
        .medium-editor h3 {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 16px 0 8px 0;
          line-height: 1.4;
        }
        
        .medium-editor ul, .medium-editor ol {
          margin: 16px 0;
          padding-left: 24px;
        }
        
        .medium-editor li {
          margin: 8px 0;
        }
        
        .medium-editor a {
          color: #2563eb;
          text-decoration: underline;
        }
        
        .medium-editor a:hover {
          color: #1d4ed8;
        }
        
        /* Ensure formatting is visible */
        .medium-editor strong {
          font-weight: bold !important;
        }
        .medium-editor em {
          font-style: italic !important;
        }
        .medium-editor u {
          text-decoration: underline !important;
        }
        
        /* Fix text direction issues */
        .medium-editor {
          direction: ltr !important;
          text-align: left !important;
          unicode-bidi: normal !important;
        }
        
        .medium-editor * {
          direction: ltr !important;
          unicode-bidi: normal !important;
        }
      `}</style>
    </div>
  );
}

