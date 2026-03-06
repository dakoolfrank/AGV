'use client';

import { ExclamationTriangleIcon, InfoCircledIcon, LockClosedIcon } from '@radix-ui/react-icons';

export function MainDisclaimer() {
  return (
    <div className="w-full mb-6 flex justify-center">
      <div className="max-w-4xl w-full">
        {/* Main disclaimer - always visible */}
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm rounded-xl border border-slate-600/30 p-4 shadow-lg mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <div className="p-2 bg-red-500/20 rounded-lg border border-red-400/30">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                Financial Disclaimer
              </h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              This page outlines milestone targets for product and community growth. It is not financial advice or a promise of returns.
            </p>
          </div>
        </div>

        {/* Detailed sections - always visible */}
        <div className="space-y-3">
          <div className="bg-red-500/10 rounded-lg p-4 border border-red-400/20">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <InfoCircledIcon className="w-5 h-5 text-red-300" />
                <h4 className="text-sm font-semibold text-red-200">Investment Warning</h4>
              </div>
              <p className="text-sm text-red-100 leading-relaxed">
                This page outlines milestone targets for product and community growth. It is not financial advice or a promise of returns.
              </p>
            </div>
          </div>
          
          <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-400/20">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <LockClosedIcon className="w-5 h-5 text-orange-300" />
                <h4 className="text-sm font-semibold text-orange-200">Target Bands & Metrics</h4>
              </div>
              <p className="text-sm text-orange-100 leading-relaxed">
                Target price bands are indicative and may adjust with milestone completion and market conditions. 
                All metrics rely on on-chain data and third-party dashboards/audits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
