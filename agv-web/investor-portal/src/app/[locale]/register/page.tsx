'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiBriefcase, FiMail, FiUser, FiMessageSquare, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Button from '@/components/Button';
import { validatePasswordStrength } from '@/lib/password-validation';

interface RegistrationForm {
  organizationName: string;
  workEmail: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
  contactName: string;
  message: string;
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegistrationForm>({
    organizationName: '',
    workEmail: '',
    confirmEmail: '',
    password: '',
    confirmPassword: '',
    contactName: '',
    message: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Validate password strength in real-time
    if (name === 'password') {
      const validation = validatePasswordStrength(value);
      setPasswordErrors(validation.errors);
    } else if (name === 'password' && value === '') {
      setPasswordErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setPasswordErrors([]);

    // Validate email confirmation
    if (formData.workEmail.trim().toLowerCase() !== formData.confirmEmail.trim().toLowerCase()) {
      setErrorMessage('Email addresses do not match');
      setSubmitting(false);
      return;
    }

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match');
      setSubmitting(false);
      return;
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(formData.password);
    if (!passwordValidation.valid) {
      setPasswordErrors(passwordValidation.errors);
      setErrorMessage('Please fix password requirements');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/organizations/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: formData.organizationName.trim(),
          workEmail: formData.workEmail.trim(),
          password: formData.password,
          contactName: formData.contactName.trim() || undefined,
          message: formData.message.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
      }

      setSuccessMessage(
        'Your account has been created! Your organization registration is pending approval. You will be notified once approved.',
      );
      setFormData({
        organizationName: '',
        workEmail: '',
        confirmEmail: '',
        password: '',
        confirmPassword: '',
        contactName: '',
        message: '',
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to submit your request right now.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-muted/30 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-sm uppercase tracking-wider text-primary font-semibold">Dataroom Access</p>
          <h1 className="text-4xl font-bold text-foreground mt-2">Request Investor Dataroom Access</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            Submit your organization details using a corporate email address. We’ll verify your request and
            provision a dedicated entry point for your team.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name *
              </label>
              <div className="relative">
                <FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="organizationName"
                  name="organizationName"
                  required
                  minLength={2}
                  maxLength={120}
                  value={formData.organizationName}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter your organization's legal name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="workEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Work Email *
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="workEmail"
                  name="workEmail"
                  type="email"
                  required
                  value={formData.workEmail}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Email *
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmEmail"
                  name="confirmEmail"
                  type="email"
                  required
                  value={formData.confirmEmail}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Re-enter your email"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Public email domains (Gmail, Outlook, Yahoo, etc.) are declined automatically.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                </button>
              </div>
              {passwordErrors.length > 0 && (
                <ul className="mt-2 text-sm text-red-600 space-y-1">
                  {passwordErrors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Must be at least 12 characters with uppercase, lowercase, number, and special character.
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-2">
                Contact Name (optional)
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="contactName"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Primary point of contact"
                />
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <div className="relative">
                <FiMessageSquare className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  maxLength={1000}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Include any context about your investment objectives or timeline."
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1 text-right">
                {formData.message.length}/1000
              </p>
            </div>

            {successMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {successMessage}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Submission reviews typically take less than 24 hours.
              </p>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Registration'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

