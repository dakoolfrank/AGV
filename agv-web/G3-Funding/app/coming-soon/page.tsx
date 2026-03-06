import React from "react";
import { Clock, ArrowLeft, Zap, Globe, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FastLink } from "@/components/ui/fast-link";
import Image from "next/image";
import Link from "next/link";

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      backgroundImage: 'url(/herobg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* Background overlay for better text readability */}
      <div className="absolute inset-0 bg-white/20"></div>
      
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Logo */}
        <div className="mb-8">
          <FastLink href="/" className="inline-flex items-center space-x-3">
            <div className="w-12 h-12 bg-[#223256] rounded-lg flex items-center justify-center">
              <span className="font-bold text-lg text-white">G3</span>
            </div>
            <span className="text-white font-bold text-xl">G3 FUND</span>
          </FastLink>
        </div>

        {/* Main Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 sm:p-12 mb-8 border border-white/20">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center">
              <Clock className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            Coming Soon
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl text-white/90 mb-8 leading-relaxed">
            We&apos;re working hard to bring you something amazing. 
            <br />
            Stay tuned for updates!
          </p>

          {/* Features Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <Zap className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-white/80 text-sm font-medium">Lightning Fast</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <Globe className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-white/80 text-sm font-medium">Multi-Chain</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <Users className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-white/80 text-sm font-medium">Community</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <Shield className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-white/80 text-sm font-medium">Secure</p>
            </div>
          </div>

          {/* Back Button */}
          <Link href="/">
            <Button 
              size="lg" 
              className="bg-[#223256] text-white hover:bg-[#1a2640] px-8 py-3 text-lg font-semibold flex items-center space-x-2 mx-auto"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </Button>
          </Link>
        </div>

        {/* Footer Text */}
        <p className="text-white/70 text-sm">
          Follow us for updates on our journey to revolutionize real-world asset tokenization
        </p>
      </div>
    </div>
  );
}
