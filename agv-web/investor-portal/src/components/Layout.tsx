import React from 'react';
import { motion } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import BackToWebsiteButton from './BackToWebsiteButton';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function Layout({ children, className = '' }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`flex-1 ${className}`}
      >
        {children}
      </motion.main>
      <Footer />
      <BackToWebsiteButton />
    </div>
  );
}
