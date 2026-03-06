"use client";
import React, { useEffect, useState } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { useTranslations } from "@/hooks/useTranslations";
import { getBlogPostBySlug, incrementViewCount, BlogPost } from "@/lib/blog";
import { ArrowLeft, Calendar, User, Eye, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function BlogDetailPage() {
  const { t } = useTranslations();
  const params = useParams();
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = params?.slug as string;
  const locale = params?.locale as string;

  useEffect(() => {
    const fetchBlogPost = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        const post = await getBlogPostBySlug(slug);
        
        if (post) {
          setBlogPost(post);
          // Increment view count
          if (post.id) {
            await incrementViewCount(post.id);
          }
        } else {
          setError("Blog post not found");
        }
      } catch (err) {
        console.error("Error fetching blog post:", err);
        setError("Failed to load blog post");
      } finally {
        setLoading(false);
      }
    };

    fetchBlogPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4FACFE] mx-auto mb-4"></div>
            <p className="text-[#223256]">{t('blog.detail.loading')}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !blogPost) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#223256] mb-4">
              {t('blog.detail.notFound')}
            </h1>
            <Link href={`/${locale}/blog`}>
              <Button className="bg-[#4FACFE] text-white hover:bg-[#3B8BCC]">
                {t('blog.detail.backToBlog')}
              </Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[70pc] left-0 w-[1000px] h-[1000px] bg-[#4FACFE]/10 rounded-full -translate-x-[600px] -translate-y-[600px]"></div>
        <div className="absolute top-[100pc] right-0 w-[1000px] h-[1000px] bg-[#4FACFE]/10 rounded-full translate-x-[500px] -translate-y-[500px]"></div>
      </div>
      
      <Header />
      
      {/* Back Button */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10">
        <Link href={`/${locale}/blog`}>
          <Button variant="ghost" className="flex items-center space-x-2 text-[#223256] hover:text-[#4FACFE]">
            <ArrowLeft className="w-4 h-4" />
            <span>{t('blog.detail.backToBlog')}</span>
          </Button>
        </Link>
      </div>

      {/* Blog Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Featured Image */}
        {blogPost.featuredImage && (
          <div className="mb-8">
            <Image
              src={blogPost.featuredImage}
              alt={blogPost.title}
              width={800}
              height={400}
              className="w-full h-64 sm:h-80 lg:h-96 object-cover rounded-2xl"
            />
          </div>
        )}

        {/* Article Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="bg-[#4FACFE]/10 text-[#4FACFE] px-3 py-1 rounded-full text-sm font-semibold">
              {t(`blog.tabs.${blogPost.category.toLowerCase()}`)}
            </span>
            {blogPost.featured && (
              <span className="bg-[#223256]/10 text-[#223256] px-3 py-1 rounded-full text-sm font-semibold">
                {t('blog.detail.featured')}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#223256] mb-4 leading-tight">
            {blogPost.title}
          </h1>

          <p className="text-lg text-[#223256]/80 mb-6 leading-relaxed">
            {blogPost.excerpt}
          </p>

          {/* Article Meta */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-[#223256]/70">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>{blogPost.author}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(blogPost.publishedAt || blogPost.createdAt)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>{blogPost.views} {t('blog.detail.views')}</span>
            </div>
          </div>

          {/* Tags */}
          {blogPost.tags && blogPost.tags.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center space-x-2 mb-3">
                <Tag className="w-4 h-4 text-[#223256]/70" />
                <span className="text-sm text-[#223256]/70">{t('blog.detail.tags')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {blogPost.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-white/80 backdrop-blur-sm text-[#223256] px-3 py-1 rounded-full text-sm border border-gray-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Article Content */}
        <div className="prose prose-lg max-w-none">
          <div 
            className="text-[#223256] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: blogPost.content }}
          />
        </div>
      </article>

      {/* Related Articles or CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center border border-gray-100">
          <h3 className="text-xl font-bold text-[#223256] mb-4">
            {t('blog.detail.enjoyedArticle')}
          </h3>
          <p className="text-[#223256]/70 mb-6">
            {t('blog.detail.newsletterDescription')}
          </p>
          <Link href={`/${locale}/blog`}>
            <Button className="bg-[#4FACFE] text-white hover:bg-[#3B8BCC]">
              {t('blog.detail.readMoreArticles')}
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
