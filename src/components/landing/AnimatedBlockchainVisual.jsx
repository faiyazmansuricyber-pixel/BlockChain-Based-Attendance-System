import React from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { ShieldCheck, Blocks, Lock, CheckCircle2 } from 'lucide-react';

export const AnimatedBlockchainVisual = () => {
  const { latestBlockNumber, chainId } = useWeb3();

  return (
    <div className="relative w-full max-w-lg mx-auto aspect-square flex items-center justify-center">
      {/* Outer Pulse Glow Ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 via-purple-500/20 to-pink-500/20 blur-3xl animate-pulse" />
      
      {/* Concentric Decorative Rings */}
      <div className="absolute w-[90%] h-[90%] rounded-full border border-cyan-500/20 animate-spin" style={{ animationDuration: '30s' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cyan-400 shadow-neon-cyan" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-400 shadow-neon-purple" />
      </div>

      <div className="absolute w-[70%] h-[70%] rounded-full border border-purple-500/20 animate-spin" style={{ animationDuration: '20s', animationDirection: 'reverse' }}>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-pink-400" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400" />
      </div>

      {/* Central Floating Block Node */}
      <div className="relative z-10 glass-panel p-8 rounded-3xl border-2 border-cyan-500/40 shadow-2xl shadow-cyan-500/20 flex flex-col items-center text-center animate-float">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 shadow-neon-cyan mb-4">
          <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-cyan-300 animate-pulse" />
          </div>
        </div>

        <h4 className="font-heading font-bold text-lg text-white">
          Block #{latestBlockNumber ? latestBlockNumber.toString() : 'Syncing...'} Verified
        </h4>
        <p className="text-xs text-slate-400 mt-1">Proof-of-Attendance Protocol</p>

        <div className="mt-4 pt-4 border-t border-white/10 w-full flex items-center justify-between text-xs text-slate-300 font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Immutable Ledger
          </span>
          <span className="text-cyan-400">Chain ID: {chainId || 31337}</span>
        </div>
      </div>

      {/* Satellite Node 1 */}
      <div className="absolute -top-2 left-6 glass-panel p-3 rounded-2xl border border-cyan-500/30 flex items-center gap-2.5 shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
        <Blocks className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-slate-200">Smart Contract</span>
      </div>

      {/* Satellite Node 2 */}
      <div className="absolute -bottom-2 right-4 glass-panel p-3 rounded-2xl border border-purple-500/30 flex items-center gap-2.5 shadow-lg animate-bounce" style={{ animationDuration: '4s' }}>
        <Lock className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-semibold text-slate-200">ECDSA Signature</span>
      </div>
    </div>
  );
};
