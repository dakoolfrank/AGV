'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

export default function BackToWebsiteButton() {
  return (
    <motion.a
      href="https://www.agvprotocol.org/en/landing"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-sm sm:text-base"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
    >
      <span>Back to website</span>
      <ExternalLink className="w-4 h-4" />
    </motion.a>
  );
}



