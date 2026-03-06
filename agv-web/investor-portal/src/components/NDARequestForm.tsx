'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import NDAModal from './NDAModal';
import { useTranslations } from '@/hooks/useTranslations';

export default function NDARequestForm() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslations();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white rounded-xl shadow-lg p-6 sm:p-8"
      >
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {t('contact.nda.form.title')}
          </h3>
          <p className="text-gray-600">
            {t('contact.nda.form.description')}
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          size="lg"
          className="w-full"
        >
          {t('contact.nda.form.submit')}
        </Button>
      </motion.div>

      <NDAModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
