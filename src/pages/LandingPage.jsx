import React from 'react';
import { useWeb3 } from '../context/Web3Context';
import { AnimatedBlockchainVisual } from '../components/landing/AnimatedBlockchainVisual';
import { Shield, Sparkles, QrCode, Lock, ArrowRight, Activity } from 'lucide-react';

export const LandingPage = ({ onNavigate }) => {
  const { connectWallet, account } = useWeb3();

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative pt-6 lg:pt-12 flex flex-col lg:flex-row items-center justify-between gap-12">
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>TechQuest Tech Fest Special • Ethereum Local Layer</span>
          </div>

          <h1 className="text-4xl lg:text-6xl font-heading font-extrabold tracking-tight leading-tight text-white">
            Tamper-Proof Academic Attendance on <span className="neon-gradient-text">Blockchain</span>
          </h1>

          <p className="text-base lg:text-lg text-slate-300 max-w-xl font-normal leading-relaxed">
            Eliminate proxy attendance and record tampering with cryptographic ECDSA signatures, timed 32-byte QR secrets, and transparent smart contract verification.
          </p>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
            {!account ? (
              <button
                onClick={connectWallet}
                className="px-8 py-4 rounded-2xl font-heading font-bold text-sm bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-neon-cyan transition-all flex items-center gap-3 group"
              >
                <span>Connect MetaMask Wallet</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('student')}
                className="px-8 py-4 rounded-2xl font-heading font-bold text-sm bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-neon-cyan transition-all flex items-center gap-3 group"
              >
                <span>Go to Student Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <button
              onClick={() => onNavigate('verify')}
              className="px-6 py-4 rounded-2xl font-heading font-bold text-sm bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-2"
            >
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Public Verification Portal</span>
            </button>
          </div>
        </div>

        {/* Animated Hero Visual */}
        <div className="flex-1 w-full max-w-md lg:max-w-none">
          <AnimatedBlockchainVisual />
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/10 hover:border-cyan-500/30 transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-heading font-bold text-white mb-2">Dynamic 32-Byte Secrets</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Teachers launch class sessions generating a dynamic 32-byte secret payload embedded in QR code, expiring in 5 to 10 minutes.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-white/10 hover:border-purple-500/30 transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-heading font-bold text-white mb-2">Signed, Time-Limited Check-ins</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Students sign check-in proofs with their private wallet key. Smart contract guarantees time validity &amp; prevents duplicate entries.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-white/10 hover:border-emerald-500/30 transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-heading font-bold text-white mb-2">Real-Time Event Stream</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Attendance marks emit smart contract events instantly displaying live check-in telemetry on teacher displays.
          </p>
        </div>
      </section>
    </div>
  );
};
