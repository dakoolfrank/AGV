'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = 'info',
  isVisible,
  onClose,
  duration = 5000,
}: ToastProps) {
  React.useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const icons = {
    info: FiInfo,
    success: FiCheckCircle,
    warning: FiAlertCircle,
    error: FiAlertCircle,
  };

  const colors = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const Icon = icons[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`fixed top-4 right-4 z-50 max-w-md w-full ${colors[type]} border rounded-lg shadow-lg p-4 flex items-start space-x-3`}
        >
          <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="flex-1 text-sm font-medium">{message}</p>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

