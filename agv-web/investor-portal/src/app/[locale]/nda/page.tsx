'use client';

import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { motion } from 'framer-motion';
import { FiCheck, FiX, FiFileText, FiShield } from 'react-icons/fi';
import { useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

export default function NDAPage() {
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

  return (
    <Layout>
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <SectionHeader
            title={t('nda.title')}
            subtitle={t('nda.subtitle')}
            description={t('nda.description')}
            className="mb-16"
          />

          {/* NDA Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <Card className="p-8 bg-primary/5 border-primary/20">
              <div className="flex items-start mb-6">
                <div className="text-primary mr-4 mt-1">
                  <FiShield size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold mb-4">{t('nda.info.title')}</h2>
                  <p className="text-muted-foreground mb-4">
                    {t('nda.info.description')}
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center">
                      <FiCheck className="text-primary mr-2" size={16} />
                      {t('nda.info.benefits.confidentiality')}
                    </li>
                    <li className="flex items-center">
                      <FiCheck className="text-primary mr-2" size={16} />
                      {t('nda.info.benefits.access')}
                    </li>
                    <li className="flex items-center">
                      <FiCheck className="text-primary mr-2" size={16} />
                      {t('nda.info.benefits.protection')}
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* NDA Request Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="p-8">
              <div className="flex items-center mb-6">
                <div className="text-primary mr-3">
                  <FiFileText size={24} />
                </div>
                <h2 className="text-2xl font-semibold">{t('nda.form.title')}</h2>
              </div>
              
              {/* Success Message */}
              {submitStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center"
                >
                  <FiCheck className="text-green-600 mr-2" size={20} />
                  <span className="text-green-800">{t('nda.form.success')}</span>
                </motion.div>
              )}

              {/* Error Message */}
              {submitStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center"
                >
                  <FiX className="text-red-600 mr-2" size={20} />
                  <span className="text-red-800">{errorMessage}</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                    {t('nda.form.name')} *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder={t('nda.form.namePlaceholder')}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                    {t('nda.form.title')} *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    placeholder={t('nda.form.titlePlaceholder')}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-foreground mb-2">
                    {t('nda.form.organization')} *
                  </label>
                  <input
                    type="text"
                    id="organization"
                    name="organization"
                    value={formData.organization}
                    onChange={handleInputChange}
                    required
                    placeholder={t('nda.form.organizationPlaceholder')}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    {t('nda.form.email')} *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder={t('nda.form.emailPlaceholder')}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('nda.form.emailNote')}
                  </p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {t('nda.form.disclaimer')}
                  </p>
                </div>

                <Button 
                  type="submit" 
                  variant="primary" 
                  size="lg" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('nda.form.sending') : t('nda.form.submit')}
                </Button>
              </form>
            </Card>
          </motion.div>

          {/* Additional Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12"
          >
            <Card className="p-8">
              <h3 className="text-xl font-semibold mb-4">{t('nda.process.title')}</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-4 mt-1">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{t('nda.process.step1.title')}</h4>
                    <p className="text-sm text-muted-foreground">{t('nda.process.step1.description')}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-4 mt-1">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{t('nda.process.step2.title')}</h4>
                    <p className="text-sm text-muted-foreground">{t('nda.process.step2.description')}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-4 mt-1">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{t('nda.process.step3.title')}</h4>
                    <p className="text-sm text-muted-foreground">{t('nda.process.step3.description')}</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
