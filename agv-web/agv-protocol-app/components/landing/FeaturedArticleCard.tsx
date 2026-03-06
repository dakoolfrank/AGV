import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/hooks/useTranslations";
import Image from "next/image";

interface FeaturedArticleCardProps {
  image: string;
  title: string;
  description: string;
  onReadMore: () => void;
}

export const FeaturedArticleCard: React.FC<FeaturedArticleCardProps> = ({ 
  image, 
  title, 
  description, 
  onReadMore 
}) => {
  const { t } = useTranslations();
  
  // Validate image URL
  const isValidImageUrl = (url: string): boolean => {
    if (!url || !url.trim()) return false;
    try {
      const trimmedUrl = url.trim();
      const urlObj = new URL(trimmedUrl);
      const validProtocols = ['http:', 'https:'];
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      
      if (!validProtocols.includes(urlObj.protocol)) return false;
      
      const pathname = urlObj.pathname.toLowerCase();
      return validExtensions.some(ext => pathname.endsWith(ext));
    } catch {
      return false;
    }
  };

  const imageSrc = isValidImageUrl(image) ? image.trim() : "/blog/featured-article.png";
  
  return (
    <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
      {/* Article Image */}
      <div className="flex-1 w-full lg:w-auto">
        <Image
          src={imageSrc}
          alt={title}
          width={400}
          height={250}
          className="w-full h-88 sm:h-56 lg:h-88 object-cover rounded-t-lg lg:rounded-l-lg lg:rounded-tr-none"
        />
      </div>
      
      {/* Content */}
      <div className="flex-1 space-y-3 sm:space-y-4 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg lg:text-xl font-bold text-[#223256] leading-tight">{title}</h3>
        <p className="text-xs sm:text-sm text-[#223256] leading-relaxed">{description}</p>
        
        {/* Read More Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onReadMore}
          className="bg-white border border-[#223256] text-[#223256] hover:bg-[#223256] hover:text-white transition-all duration-300 px-6 sm:px-8 py-2 sm:py-3 rounded-md font-semibold flex items-center space-x-2 text-xs sm:text-sm"
        >
          <span>{t('common.readMore') || 'Read More'}</span>
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
        </Button>
      </div>
    </div>
  );
};
