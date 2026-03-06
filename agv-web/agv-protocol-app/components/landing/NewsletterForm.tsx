import React, { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/hooks/useTranslations";

export const NewsletterForm: React.FC = () => {
  const { t } = useTranslations();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle newsletter subscription
    console.log("Newsletter subscription:", email);
    setEmail("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex space-x-2 items-center justify-center">
        <Input
          type="email"
          placeholder={t('blog.newsletter.emailPlaceholder') || "Enter your email"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 border-gray-300 focus:border-[#223256] focus:ring-[#223256]"
          required
        />
        <Button
          type="submit"
          size="sm"
          className="bg-[#223256] text-md hover:border hover:border-[#223256] text-white hover:bg-white hover:text-[#223256] transition-all duration-300 px-4 py-4 rounded-sm font-semibold flex items-center space-x-1"
        >
{t('blog.newsletter.send')}
        </Button>
      </div>
    </form>
  );
};
