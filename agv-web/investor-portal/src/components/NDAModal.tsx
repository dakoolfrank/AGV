'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiUser, FiBriefcase, FiHome, FiMail, FiCheck } from 'react-icons/fi';
import { useTranslations } from '@/hooks/useTranslations';
import Button from './Button';

interface NDAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NDAModal({ isOpen, onClose }: NDAModalProps) {
  const { t } = useTranslations();
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    organization: '',
    email: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/nda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({
          name: '',
          title: '',
          organization: '',
          email: ''
        });
        // Close modal after 2 seconds on success
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const errorData = await response.json();
        setSubmitStatus('error');
        setErrorMessage(errorData.error || t('nda.form.error'));
      }
    } catch {
      setSubmitStatus('error');
      setErrorMessage(t('nda.form.networkError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        name: '',
        title: '',
        organization: '',
        email: ''
      });
      setSubmitStatus('idle');
      setErrorMessage('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-md bg-white rounded-xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {t('nda.form.title')}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {t('nda.description')}
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Success Message */}
              {submitStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center"
                >
                  <FiCheck className="text-green-600 mr-2" size={20} />
                  <span className="text-green-800 text-sm">{t('nda.form.success')}</span>
                </motion.div>
              )}

              {/* Error Message */}
              {submitStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center"
                >
                  <FiX className="text-red-600 mr-2" size={20} />
                  <span className="text-red-800 text-sm">{errorMessage}</span>
                </motion.div>
              )}

              {/* Name Field */}
              <div>
                <label htmlFor="modal-name" className="block text-sm font-medium text-gray-700 mb-2">
                  <FiUser className="inline mr-2" />
                  {t('nda.form.name')} *
                </label>
                <input
                  type="text"
                  id="modal-name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder={t('nda.form.namePlaceholder')}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>

              {/* Title Field */}
              <div>
                <label htmlFor="modal-title" className="block text-sm font-medium text-gray-700 mb-2">
                  <FiBriefcase className="inline mr-2" />
                  {t('nda.form.title')} *
                </label>
                <input
                  type="text"
                  id="modal-title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder={t('nda.form.titlePlaceholder')}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>

              {/* Organization Field */}
              <div>
                <label htmlFor="modal-organization" className="block text-sm font-medium text-gray-700 mb-2">
                  <FiHome className="inline mr-2" />
                  {t('nda.form.organization')} *
                </label>
                <input
                  type="text"
                  id="modal-organization"
                  name="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  placeholder={t('nda.form.organizationPlaceholder')}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700 mb-2">
                  <FiMail className="inline mr-2" />
                  {t('nda.form.email')} *
                </label>
                <input
                  type="email"
                  id="modal-email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={t('nda.form.emailPlaceholder')}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('nda.form.emailNote')}
                </p>
              </div>

              {/* Disclaimer */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600">
                  {t('nda.form.disclaimer')}
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? t('nda.form.sending') : t('nda.form.submit')}
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
