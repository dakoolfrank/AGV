"use client";
import React from "react";
import { FileText } from "lucide-react";

interface Article {
    title: string;
    description: string;
}

interface ThreeLayerProps {
    title: string;
    articles: Article[];
    className?: string;
    icon?: React.ReactNode;
}

export const ThreeLayer: React.FC<ThreeLayerProps> = ({ 
    title, 
    articles, 
    className = "bg-white py-16 sm:py-20",
    icon = <FileText className="text-4xl text-gray-600" />
}) => {
    return (
        <section className={className}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center">
                {/* Title */}
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#223256] mb-6 sm:mb-8">
                    {title}
                </h2>

                <div className="mb-8">
                    <div className="grid gap-10 md:grid-cols-4">
                        {articles && articles.length > 0 ? articles.map((article, index) => (
                            <div key={index} className="bg-white border border-gray-200 rounded-2xl p-6 group hover:shadow-lg transition-all duration-300 text-center">
                                <div className="flex items-center space-x-3 mb-3 justify-center">
                                    <div className="p-2 rounded-lg bg-gray-100">
                                        {icon}
                                    </div>
                                </div>
                                <h4 className="font-semibold text-[#223256] mb-2 text-center">{article.title}</h4>
                                <p className="text-[#223256] text-sm mb-4 tracking-widest">{article.description}</p>
                            </div>
                        )) : (
                            <div className="col-span-full text-center text-gray-500">
                                No articles available
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </section>
    );
};
