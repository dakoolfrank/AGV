"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { ArticleCard } from "@/components/landing/ArticleCard";
import { FeaturedArticleCard } from "@/components/landing/FeaturedArticleCard";
import { SearchForm } from "@/components/landing/SearchForm";
import { NewsletterForm } from "@/components/landing/NewsletterForm";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "@/hooks/useTranslations";
import { getBlogPosts, BlogPost } from "@/lib/blog";
import { useParams, useRouter } from "next/navigation";

export default function BlogPage() {
  const { t } = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale as string;
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const tabs = ["ALL", "ANNOUNCEMENTS", "TECH", "COMMUNITY"];

  const fetchBlogPosts = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {
        category: activeTab !== "ALL" ? activeTab : undefined,
        search: searchQuery || undefined,
        published: true
      };
      const posts = await getBlogPosts(filters);
      setBlogPosts(posts);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchBlogPosts();
  }, [fetchBlogPosts]);

  // Get featured article (first featured post or first post)
  const featuredArticle = blogPosts.find(post => post.featured) || blogPosts[0];
  
  // Get other articles (exclude featured)
  const otherArticles = blogPosts.filter(post => post.id !== featuredArticle?.id);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleReadMore = (slug: string) => {
    // Navigate to blog detail page using Next.js router
    router.push(`/${locale}/blog/${slug}`);
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Left semicircle */}
        <div className="absolute top-[70pc] left-0 w-[1000px] h-[1000px] bg-[#4FACFE]/10 rounded-full -translate-x-[600px] -translate-y-[600px]"></div>
        {/* Right semicircle */}
        <div className="absolute top-[100pc] right-0 w-[1000px] h-[1000px] bg-[#4FACFE]/10 rounded-full translate-x-[500px] -translate-y-[500px]"></div>
      </div>
      
      {/* Header */}
      <Header />
      
      {/* Hero Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-transparent flex items-center justify-center relative z-10">
        <div className="mx-auto max-w-4xl flex-1">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-[#223256] mb-4 sm:mb-6 uppercase">
              {t('blog.hero.title')}
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-[#223256] px-2 sm:px-4 md:px-8 lg:px-16 xl:px-36 text-center leading-relaxed">
              {t('blog.hero.subtitle')}
            </p>
          </div>
        </div>
      </section>

      
      {/* Featured Articles Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-left mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#223256] mb-4">
              {t('blog.featured.title')}
            </h2>
          </div>

          <div>
            {/* Featured Article Card - Only show if there's a featured article */}
            {featuredArticle && (
              <div className="order-1 lg:order-1">
                <FeaturedArticleCard
                  image={featuredArticle.featuredImage || "/blog/featured-article.png"}
                  title={featuredArticle.title}
                  description={featuredArticle.excerpt}
                  onReadMore={() => handleReadMore(featuredArticle.slug)}
                />
              </div>
            )}
          </div>
        </div>
      </section>


      {/* Tab Navigation */}
      <section className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 bg-transparent border-b border-gray-200 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
            <div className="flex flex-wrap gap-2 sm:gap-4">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-full font-semibold transition-all duration-300 text-xs sm:text-sm ${
                    activeTab === tab
                      ? "bg-[#223256] text-white"
                      : "bg-white/80 backdrop-blur-sm text-[#223256] hover:bg-white/90 border border-gray-200"
                  }`}
                >
                  {t(`blog.tabs.${tab.toLowerCase()}`)}
                </button>
              ))}
            </div>
            <div className="w-full sm:w-auto">
              <SearchForm onSearch={handleSearch} placeholder={t('blog.searchPlaceholder')} />
            </div>
          </div>
        </div>
      </section>

      {/* Main Articles Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-left mb-8 sm:mb-12">
              {(activeTab !== "ALL" || searchQuery) && (
                <p className="text-[#223256] text-xs sm:text-sm">
                  {otherArticles.length} {t('blog.main.articlesFound')}
                  {activeTab !== "ALL" && ` ${t('blog.main.inCategory').replace('{category}', t(`blog.tabs.${activeTab.toLowerCase()}`))}`}
                  {searchQuery && ` ${t('blog.main.forQuery').replace('{query}', searchQuery)}`}
                </p>
              )}
            </div>

          {/* Articles Container */}
          <div className="rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4FACFE]"></div>
              </div>
            ) : otherArticles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {otherArticles.map((article, index) => (
                  <ArticleCard
                    key={article.id || index}
                    image={article.featuredImage || "/blog/article.png"}
                    title={article.title}
                    description={article.excerpt}
                    onReadMore={() => handleReadMore(article.slug)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-[#223256] text-lg sm:text-xl font-medium">
                  {searchQuery ? t('blog.main.noResultsForQuery').replace('{query}', searchQuery) : t('blog.main.noResultsInCategory').replace('{category}', t(`blog.tabs.${activeTab.toLowerCase()}`) || activeTab)}
                </p>
              </div>
            )}
            <div className="text-center mt-8 sm:mt-10">
              <Button
                size="lg"
                className="bg-white/80 backdrop-blur-sm border border-[#223256] text-[#223256] hover:bg-[#223256] hover:text-white transition-all duration-300 px-6 sm:px-8 py-2 sm:py-3 rounded-lg font-semibold flex items-center space-x-2 mx-auto text-sm sm:text-base"
              >
                <span>{t('blog.main.viewAllPosts')}</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
          
        </div>
      </section>
      {/* Newsletter Form */}
      <section className="pb-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row">
            <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 flex-1">

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#223256] mb-2">{t('blog.newsletter.title')}</h3>
                  <p className="text-[#223256] text-xs sm:text-sm leading-relaxed">
                    {t('blog.newsletter.description')}
                  </p>
                </div>
                <NewsletterForm />
              </div>
            </div>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 flex-1 hidden lg:block">
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}