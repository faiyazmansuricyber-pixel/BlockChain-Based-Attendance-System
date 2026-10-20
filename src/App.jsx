import React, { useState } from 'react';
import { Web3Provider, useWeb3 } from './context/Web3Context';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/ToastContainer';
import { LandingPage } from './pages/LandingPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { StudentDashboard } from './pages/StudentDashboard';
import { VerificationPage } from './pages/VerificationPage';
import { AlertTriangle } from 'lucide-react';

function ContractStatusBanner() {
  const { contractNotFound, isWrongNetwork, chainId, ensureHardhatNetwork } = useWeb3();

  if (isWrongNetwork) {
    return (
      <div className="bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-rose-500/20 border-b border-rose-500/40 text-rose-200 px-4 py-3 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-3 z-50 backdrop-blur-md">
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
        <span>
          Wrong Network: Connected to Chain ID #{chainId || 'Unknown'}. Switch to <strong>Hardhat Local (Chain ID: 31337)</strong>.
        </span>
        <button
          onClick={ensureHardhatNetwork}
          className="ml-2 px-3 py-1 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-400/50 rounded-lg text-xs font-bold text-white transition-all shadow-sm"
        >
          Switch Network
        </button>
      </div>
    );
  }

  if (contractNotFound) {
    return (
      <div className="bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/20 border-b border-amber-500/40 text-amber-200 px-4 py-3 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2 z-50 backdrop-blur-md">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
        <span>
          Contract not found on this chain. Run <code className="bg-amber-950/80 px-2.5 py-0.5 rounded text-cyan-300 font-mono text-xs border border-amber-500/30 font-bold">npm run demo</code> to deploy contract &amp; register class.
        </span>
      </div>
    );
  }

  return null;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('landing');
  const { chainId } = useWeb3();

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 font-sans flex flex-col relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Global Ambient Glow Gradients */}
      <div className="fixed top-0 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-1/3 right-1/4 translate-x-1/2 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Network / Contract Status Banner */}
      <ContractStatusBanner />

      {/* Header Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 pt-8 relative z-10">
        {activeTab === 'landing' && <LandingPage onNavigate={setActiveTab} />}
        {activeTab === 'admin' && <AdminDashboard />}
        {activeTab === 'teacher' && <TeacherDashboard />}
        {activeTab === 'student' && <StudentDashboard />}
        {activeTab === 'verify' && <VerificationPage />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 TechQuest • Blockchain Academic Attendance Protocol</p>
          <p className="text-[11px] text-cyan-400 font-mono">Hardhat Local Network (Chain ID: {chainId || 31337})</p>
        </div>
      </footer>

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <MainApp />
    </Web3Provider>
  );
}
