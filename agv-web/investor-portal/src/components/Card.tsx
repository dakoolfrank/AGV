import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({
  children,
  className = '',
  hover = true,
  onClick,
}: CardProps) {
  const baseClasses = 'bg-card border border-border rounded-xl shadow-sm transition-all duration-200';
  const hoverClasses = hover ? 'hover:shadow-md hover:border-primary/20' : '';
  const clickableClasses = onClick ? 'cursor-pointer' : '';
  
  const classes = `${baseClasses} ${hoverClasses} ${clickableClasses} ${className}`;
  
  return (
    <motion.div
      className={classes}
      onClick={onClick}
      whileHover={hover ? { y: -2 } : {}}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
