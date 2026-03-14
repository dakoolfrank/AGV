'use client';

import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Card from '@/components/Card';
import Button from '@/components/Button';
import NDARequestForm from '@/components/NDARequestForm';
import { motion } from 'framer-motion';
import { FiMail, FiPhone, FiMapPin, FiCheck, FiX } from 'react-icons/fi';
import { useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

export default function ContactPage() {
  const { t } = useTranslations();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    investmentType: '',
    message: '',
    nda: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          company: '',
          investmentType: '',
          message: '',
          nda: false
        });
      } else {
        const errorData = await response.json();
        setSubmitStatus('error');
        setErrorMessage(errorData.error || t('contact.form.error'));
      }
    } catch {
      setSubmitStatus('error');
      setErrorMessage(t('contact.form.networkError'));
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <Layout>
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title={t('contact.title')}
            subtitle={t('contact.subtitle')}
            description={t('contact.description')}
            className="mb-16"
          />

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('contact.form.title')}</h2>
              
              {/* Success Message */}
              {submitStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center"
                >
                  <FiCheck className="text-green-600 mr-2" size={20} />
                  <span className="text-green-800">{t('contact.form.success')}</span>
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
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                      {t('contact.form.firstName')} *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                      {t('contact.form.lastName')} *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                      {t('contact.form.email')} *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                      {t('contact.form.phone')}
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-foreground mb-2">
                    {t('contact.form.company')}
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="investmentType" className="block text-sm font-medium text-foreground mb-2">
                    {t('contact.form.investmentType')}
                  </label>
                  <select
                    id="investmentType"
                    name="investmentType"
                    value={formData.investmentType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">{t('contact.form.selectType')}</option>
                    <option value="series-a">{t('contact.form.investmentTypes.series-a')}</option>
                    <option value="strategic">{t('contact.form.investmentTypes.strategic')}</option>
                    <option value="partnership">{t('contact.form.investmentTypes.partnership')}</option>
                    <option value="advisory">{t('contact.form.investmentTypes.advisory')}</option>
                    <option value="other">{t('contact.form.investmentTypes.other')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                    {t('contact.form.message')} *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    placeholder={t('contact.form.messagePlaceholder')}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  ></textarea>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="nda"
                    name="nda"
                    checked={formData.nda}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <label htmlFor="nda" className="ml-2 text-sm text-muted-foreground">
                    {t('contact.form.nda')}
                  </label>
                </div>

                <Button 
                  type="submit" 
                  variant="primary" 
                  size="lg" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('contact.form.sending') : t('contact.form.submit')}
                </Button>
              </form>
            </Card>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid md:grid-cols-2 gap-8"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('contact.info.title')}</h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="text-primary mt-1 mr-3">
                    <FiMail size={20} />
                  </div>
                  <div>
                    <div className='font-medium'>{t('contact.info.email')}</div>
                    <div className="text-muted-foreground">frank@agvnexrur.ai</div>
                    <div className="text-muted-foreground">frank@agvnexrur.ai</div>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="text-primary mt-1 mr-3">
                    <FiPhone size={20} />
                  </div>
                  <div>
                    <div className='font-medium'>{t('contact.info.phone')}</div>
                    <div className="text-muted-foreground">+1 (555) 123-4567</div>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="text-primary mt-1 mr-3">
                    <FiMapPin size={20} />
                  </div>
                  <div>
                    <div className='font-medium'>{t('contact.info.address')}</div>
                    <div className="text-muted-foreground">
                      123 Innovation Drive<br />
                      San Francisco, CA 94105
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('contact.actions.title')}</h2>
              <div className="space-y-4">
                <Button href="/investor" variant="primary" size="lg" className="w-full">
                  {t('contact.actions.dataRoom')}
                </Button>
                <Button href="/financials" variant="outline" size="lg" className="w-full">
                  {t('contact.actions.financials')}
                </Button>
                <Button href="/esg" variant="outline" size="lg" className="w-full">
                  {t('contact.actions.esg')}
                </Button>
                <Button href="/brandkit" variant="outline" size="lg" className="w-full">
                  {t('contact.actions.brandkit')}
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* NDA Request Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('contact.nda.title')}</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {t('contact.nda.description')}
              </p>
            </div>
            <NDARequestForm />
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
