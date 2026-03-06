import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchFormProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const SearchForm: React.FC<SearchFormProps> = ({ 
  onSearch, 
  placeholder = "Search articles..." 
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      <Input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-10 w-[20pc] border-gray-300 focus:border-[#223256] focus:ring-[#223256]"
      />
    </div>
  );
};
