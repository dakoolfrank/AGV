import React from 'react';
import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  className?: string;
  variant?: 'default' | 'white';
}

export default function SectionHeader({
  title,
  subtitle,
  description,
  className = '',
  variant = 'default',
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`text-center max-w-4xl mx-auto ${className}`}
    >
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`font-medium text-sm uppercase tracking-wider mb-2 ${
            variant === 'white' ? 'text-white/90' : 'text-primary'
          }`}
        >
          {subtitle}
        </motion.p>
      )}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className={`text-4xl md:text-5xl font-bold mb-4 ${
          variant === 'white' ? 'text-white' : 'text-foreground'
        }`}
      >
        {title}
      </motion.h1>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={`text-lg leading-relaxed ${
            variant === 'white' ? 'text-white/90' : 'text-muted-foreground'
          }`}
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}
