'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiShield, FiLogIn, FiMail } from 'react-icons/fi';

interface AuthCardProps {
  onSignIn: () => void;
  onSendMagicLink?: (email: string) => void;
  sendingLink?: boolean;
  linkSentTo?: string | null;
}

export function AuthCard({ onSignIn, onSendMagicLink, sendingLink, linkSentTo }: AuthCardProps) {
  const [emailForLink, setEmailForLink] = useState('');

  const handleSendMagicLink = () => {
    if (onSendMagicLink) {
      onSendMagicLink(emailForLink);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-lg shadow-lg p-8"
      >
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <FiShield className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Admin Dashboard
          </h2>
          <p className="text-gray-600 mb-6">
            Sign in to access the AGV Protocol admin panel
          </p>
          
          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors mb-4"
          >
            <FiLogIn className="h-5 w-5" />
            <span>Continue with Google</span>
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium text-gray-700">Sign in with Email</label>
            <input
              type="email"
              placeholder="email@domain.com"
              value={emailForLink}
              onChange={(e) => setEmailForLink(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button 
              onClick={handleSendMagicLink} 
              disabled={sendingLink || !emailForLink.trim()}
              className="w-full flex items-center justify-center space-x-2 bg-gray-100 text-gray-900 py-2 px-4 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiMail className="h-4 w-4" />
              <span>{sendingLink ? "Sending..." : "Send magic link"}</span>
            </button>
          </div>

          {linkSentTo && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-800">
                Magic link sent to <strong>{linkSentTo}</strong>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
