import React from 'react';
import { StudentSearch } from '../components/verification/StudentSearch';
import { ShieldCheck } from 'lucide-react';

export const VerificationPage = () => {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-cyan-400" />
            <span>Public On-Chain Verification Portal</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Independent, tamper-evident verification of academic attendance records stored on Ethereum
          </p>
        </div>
      </div>

      <StudentSearch />
    </div>
  );
};
