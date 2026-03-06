"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediumEditor } from './medium-editor';
import { 
  Send,
  Tag,
  User,
  Image as ImageIcon
} from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import { toast } from 'sonner';

interface SimpleBlogCreatorProps {
  initialData?: {
    title: string;
    content: string;
    excerpt: string;
    featuredImage: string;
    category: string;
    tags: string[];
    author: string;
    authorEmail: string;
    published: boolean;
    featured: boolean;
  };
  onPublish: (data: any) => Promise<void>;
  loading?: boolean;
}

export function SimpleBlogCreator({ 
  initialData, 
  onPublish, 
  loading = false 
}: SimpleBlogCreatorProps) {
  const { t } = useTranslations();
  
  
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    content: initialData?.content || '',
    excerpt: initialData?.excerpt || '',
    featuredImage: initialData?.featuredImage || '',
    category: initialData?.category || 'COMMUNITY',
    tags: initialData?.tags || [],
    author: initialData?.author || '',
    authorEmail: initialData?.authorEmail || '',
    published: initialData?.published || false,
    featured: initialData?.featured || false,
  });

  const [newTag, setNewTag] = useState('');

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handlePublish = async () => {
    await onPublish({ ...formData, published: true });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Tabs defaultValue="form" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form">Create Blog Post</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="form" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Blog Post Details</CardTitle>
              <CardDescription>Fill in all the details for your blog post</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter blog post title"
                  className="text-lg"
                />
              </div>

              {/* Excerpt */}
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt *</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => handleInputChange('excerpt', e.target.value)}
                  placeholder="Brief description of the post"
                  rows={3}
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <MediumEditor
                  content={formData.content}
                  onChange={(content) => handleInputChange('content', content)}
                  placeholder="Write your blog post content here..."
                  className="min-h-[400px]"
                />
              </div>

              {/* Featured Image */}
              <div className="space-y-2">
                <Label htmlFor="featuredImage">Featured Image</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        // Upload via API endpoint
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        // Get auth token
                        const { auth } = await import('@/lib/firebase');
                        const user = auth.currentUser;
                        if (!user) {
                          toast.error('Please log in to upload images.');
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
                        
                        if (result.success) {
                          handleInputChange('featuredImage', result.url);
                          toast.success('Featured image uploaded successfully!');
                        } else {
                          throw new Error(result.error || 'Upload failed');
                        }
                      } catch (error) {
                        console.error('Error uploading featured image:', error);
                        toast.error('Error uploading image. Please try again.');
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {formData.featuredImage && (
                  <div className="mt-2">
                    <img
                      src={formData.featuredImage}
                      alt="Featured image preview"
                      className="w-32 h-20 object-cover rounded border"
                    />
                  </div>
                )}
              </div>

              {/* Category and Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="COMMUNITY">Community</option>
                    <option value="ANNOUNCEMENTS">Announcements</option>
                    <option value="TECH">Tech</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <div className="flex space-x-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add tag"
                      className="flex-1"
                    />
                    <Button onClick={addTag} size="sm" variant="outline">
                      <Tag className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                        <span>{tag}</span>
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Author Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="author">Author Name *</Label>
                  <Input
                    id="author"
                    value={formData.author}
                    onChange={(e) => handleInputChange('author', e.target.value)}
                    placeholder="Author name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authorEmail">Author Email *</Label>
                  <Input
                    id="authorEmail"
                    value={formData.authorEmail}
                    onChange={(e) => handleInputChange('authorEmail', e.target.value)}
                    placeholder="author@example.com"
                    type="email"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.featured}
                    onChange={(e) => handleInputChange('featured', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="featured">Mark as featured post</Label>
                </div>
              </div>

              {/* Publish Button */}
              <div className="flex justify-end pt-6">
                <Button
                  onClick={handlePublish}
                  disabled={loading || !formData.title || !formData.content || !formData.excerpt || !formData.author || !formData.authorEmail}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center space-x-2 px-8 py-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{loading ? 'Publishing...' : 'Publish Blog Post'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Blog Post Preview</CardTitle>
              <CardDescription>How your blog post will appear to readers</CardDescription>
            </CardHeader>
            <CardContent>
              {formData.title ? (
                <article className="prose prose-lg max-w-none">
                  {/* Featured Image */}
                  {formData.featuredImage && (
                    <div className="w-full mb-6">
                      <img
                        src={formData.featuredImage}
                        alt="Featured image"
                        className="w-full h-64 object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Title */}
                  <h1 className="text-3xl font-bold mb-4">{formData.title}</h1>
                  
                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>{formData.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      <span>{formData.category}</span>
                    </div>
                    {formData.featured && (
                      <Badge variant="destructive">Featured</Badge>
                    )}
                  </div>
                  
                  {/* Tags */}
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {formData.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">#{tag}</Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Excerpt */}
                  <p className="text-lg text-gray-700 mb-6 font-medium">{formData.excerpt}</p>
                  
                  {/* Content */}
                  <div 
                    className="prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: formData.content }}
                  />
                </article>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>Fill in the form to see a preview of your blog post</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
