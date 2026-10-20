import React, { useState } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { shortenAddress } from '../../utils/helpers';
import { FACULTY_ROSTER, STUDENT_ROSTER, getStudentDisplayName } from '../../../roster.config';
import { Shield, Wallet, ChevronDown, Sparkles, CheckCircle2, UserCheck, Award, ArrowRight } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab }) => {
  const { account, role, roleName, connectWallet, switchDemoAccount, demoAccounts } = useWeb3();
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  const getRoleBadgeStyle = (r) => {
    switch (r) {
      case 1: return 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-neon-purple';
      case 2: return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-neon-cyan';
      case 3: return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const navItems = [
    { id: 'landing', label: 'Overview' },
    { id: 'admin', label: 'Admin Portal', roleReq: 1 },
    { id: 'teacher', label: 'Teacher Live Hub', roleReq: 2 },
    { id: 'student', label: 'Student Portal', roleReq: 3 },
    { id: 'verify', label: 'On-Chain Verification' },
  ];

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#060911]/80 border-b border-white/10 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 shadow-neon-cyan group-hover:scale-105 transition-all">
            <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-base tracking-tight neon-gradient-text leading-tight">Blockchain Based</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">dApp</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Attendance System — On-Chain Protocol</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Wallet & Quick Role Switcher */}
        <div className="flex items-center gap-3">
          {/* Quick Demo Impersonation Dropdown for TechQuest Demo */}
          {demoAccounts && demoAccounts.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowDemoMenu(!showDemoMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-all"
                title="Switch role instantly for demo testing"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                <span>Demo Switcher</span>
                <ChevronDown className="w-3 h-3 text-purple-400" />
              </button>

              {showDemoMenu && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#0B0F19] border border-purple-500/30 shadow-2xl p-2 z-50 backdrop-blur-2xl max-h-[80vh] overflow-y-auto">
                  <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-slate-400 flex items-center justify-between">
                    <span>Switch Test Role</span>
                    <span className="text-[10px] text-purple-400">Hardhat Accounts #0–#14</span>
                  </div>

                  <div className="py-1 space-y-1">
                    <div className="px-3 pt-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Admin</div>
                    <button
                      onClick={() => { switchDemoAccount(demoAccounts[0]); setActiveTab('admin'); setShowDemoMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-purple-500/20 flex items-center justify-between text-purple-300"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-purple-400" />
                        <span>Admin (Account #0)</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{shortenAddress(demoAccounts[0])}</span>
                    </button>

                    <div className="px-3 pt-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Faculty (Accounts #1–#4)</div>
                    {FACULTY_ROSTER.map((fac) => (
                      <button
                        key={fac.accountIndex}
                        onClick={() => { switchDemoAccount(demoAccounts[fac.accountIndex]); setActiveTab('teacher'); setShowDemoMenu(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-cyan-500/20 flex items-center justify-between text-cyan-300"
                      >
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{fac.name} ({fac.subjectCode})</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{shortenAddress(demoAccounts[fac.accountIndex])}</span>
                      </button>
                    ))}

                    <div className="px-3 pt-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Students (Accounts #5–#14)</div>
                    {STUDENT_ROSTER.map((st) => {
                      const isDefaulter = [8, 10, 12].includes(st.accountIndex);
                      const displayName = getStudentDisplayName(st);
                      return (
                        <button
                          key={st.accountIndex}
                          onClick={() => { switchDemoAccount(demoAccounts[st.accountIndex]); setActiveTab('student'); setShowDemoMenu(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center justify-between ${
                            isDefaulter ? 'hover:bg-rose-500/20 text-rose-300' : 'hover:bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Award className={`w-3.5 h-3.5 ${isDefaulter ? 'text-rose-400' : 'text-emerald-400'}`} />
                            <span>{displayName} {isDefaulter ? `(Defaulter - ${st.enrollmentNo})` : `(${st.enrollmentNo})`}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{shortenAddress(demoAccounts[st.accountIndex])}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connected Role Badge & Active Account Address */}
          {account && (
            <div className="flex items-center gap-1.5">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getRoleBadgeStyle(role)} flex items-center gap-1.5`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                <span>{roleName}</span>
              </span>
              <span className="font-mono text-xs text-cyan-300 font-semibold px-2 py-1 rounded-xl bg-slate-900 border border-cyan-500/30" title={account}>
                {shortenAddress(account)}
              </span>
            </div>
          )}

          {/* Wallet Button */}
          {account ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs font-mono text-cyan-300 shadow-neon-cyan">
              <Wallet className="w-3.5 h-3.5 text-cyan-400" />
              <span>{shortenAddress(account)}</span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-neon-cyan transition-all flex items-center gap-2 group"
            >
              <Wallet className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
