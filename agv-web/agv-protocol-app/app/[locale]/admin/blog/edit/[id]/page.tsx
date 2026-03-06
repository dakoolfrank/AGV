"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getBlogPost, updateBlogPost, generateSlug } from "@/lib/blog";
import { SimpleBlogCreator } from "@/components/blog/simple-blog-creator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "@/hooks/useTranslations";
import { toast } from 'sonner';

interface BlogFormData {
  title: string;
  content: string;
  excerpt: string;
  featuredImage: string;
  category: 'ANNOUNCEMENTS' | 'TECH' | 'COMMUNITY';
  tags: string[];
  author: string;
  authorEmail: string;
  published: boolean;
  featured: boolean;
}

export default function EditBlogPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string;
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialData, setInitialData] = useState<BlogFormData | null>(null);

  const blogId = params?.id as string;

  useEffect(() => {
    const fetchBlogPost = async () => {
      if (!blogId) return;
      
      try {
        setInitialLoading(true);
        console.log('Fetching blog post with ID:', blogId);
        const post = await getBlogPost(blogId);
        console.log('Fetched blog post:', post);
        
        if (post) {
          const blogData = {
            title: post.title,
            content: post.content,
            excerpt: post.excerpt,
            featuredImage: post.featuredImage,
            category: post.category,
            tags: post.tags,
            author: post.author,
            authorEmail: post.authorEmail,
            published: post.published,
            featured: post.featured
          };
          console.log('Setting initial data:', blogData);
          setInitialData(blogData);
        } else {
          console.log('Blog post not found, redirecting to blog list');
          router.push(`/${locale}/admin/blog`);
        }
      } catch (error) {
        console.error('Error fetching blog post:', error);
        router.push(`/${locale}/admin/blog`);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchBlogPost();
  }, [blogId, router, locale]);

  const handleUpdate = async (formData: BlogFormData) => {
    setLoading(true);
    try {
      console.log('Updating blog post with data:', formData);
      const tagsArray = formData.tags || [];
      const slug = generateSlug(formData.title);

      const blogPostData = {
        ...formData,
        tags: tagsArray,
        slug
      };

      console.log('Blog post data to update:', blogPostData);
      const success = await updateBlogPost(blogId, blogPostData);
      
      if (success) {
        console.log('Blog post updated successfully');
        toast.success('Blog post updated successfully!');
        router.push(`/${locale}/admin/blog`);
      } else {
        console.error('Failed to update blog post');
        toast.error(t('admin.blog.updateError'));
      }
    } catch (error) {
      console.error('Error updating blog post:', error);
      toast.error(t('admin.blog.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const doSignOut = async () => {
    await auth.signOut();
  };

  if (initialLoading) {
    return (
      <DashboardLayout 
        user={{
          email: auth.currentUser?.email,
          name: auth.currentUser?.displayName,
          avatar: auth.currentUser?.photoURL
        }}
        onSignOut={doSignOut}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4FACFE]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      user={{
        email: auth.currentUser?.email,
        name: auth.currentUser?.displayName,
        avatar: auth.currentUser?.photoURL
      }}
      onSignOut={doSignOut}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href={`/${locale}/admin/blog`}>
            <Button variant="ghost" className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>{t('admin.blog.backToBlog')}</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{t('admin.blog.editTitle')}</h1>
            <p className="text-muted-foreground">
              {t('admin.blog.editSubtitle')}
            </p>
          </div>
        </div>

        {/* Simple Blog Creator */}
        {initialData && (
          <SimpleBlogCreator
            initialData={initialData}
            onPublish={handleUpdate}
            loading={loading}
          />
        )}
      </div>
    </DashboardLayout>
  );
}