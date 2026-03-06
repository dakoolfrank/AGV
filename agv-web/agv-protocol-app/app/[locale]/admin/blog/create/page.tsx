"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { createBlogPost, generateSlug } from "@/lib/blog";
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

export default function CreateBlogPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string;
  const [loading, setLoading] = useState(false);

  const handlePublish = async (formData: BlogFormData) => {
    setLoading(true);
    try {
      const tagsArray = formData.tags || [];
      const slug = generateSlug(formData.title);

      const blogPostData = {
        ...formData,
        tags: tagsArray,
        slug,
        published: true
      };

      const postId = await createBlogPost(blogPostData);

      if (postId) {
        toast.success('Blog post created successfully!');
        router.push(`/${locale}/admin/blog`);
      } else {
        toast.error(t('admin.blog.createError'));
      }
    } catch (error) {
      console.error('Error creating blog post:', error);
      toast.error(t('admin.blog.createError'));
    } finally {
      setLoading(false);
    }
  };

  const doSignOut = async () => {
    await auth.signOut();
  };

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
            <h1 className="text-3xl font-bold">{t('admin.blog.createTitle')}</h1>
            <p className="text-muted-foreground">
              {t('admin.blog.createSubtitle')}
            </p>
          </div>
        </div>

        {/* Simple Blog Creator */}
        <SimpleBlogCreator
          onPublish={handlePublish}
          loading={loading}
        />
      </div>
    </DashboardLayout>
  );
}
