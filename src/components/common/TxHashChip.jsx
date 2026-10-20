import React, { useState } from 'react';
import { shortenAddress } from '../../utils/helpers';
import { ExternalLink, Copy, Check, ShieldCheck } from 'lucide-react';

export const TxHashChip = ({ txHash, label = 'On-Chain Tx' }) => {
  const [copied, setCopied] = useState(false);

  if (!txHash) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono group hover:border-cyan-400/60 transition-all">
      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
      <span className="text-[11px] font-sans text-cyan-400/80 font-medium">{label}:</span>
      <span>{shortenAddress(txHash)}</span>
      
      <button 
        onClick={handleCopy}
        className="ml-1 p-0.5 rounded text-cyan-400/70 hover:text-cyan-200 hover:bg-cyan-500/20 transition-all"
        title="Copy transaction hash"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      </button>

      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-sans font-semibold">
        verified
      </span>
    </div>
  );
};
