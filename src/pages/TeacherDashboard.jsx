import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../context/Web3Context';
import { StatCard } from '../components/common/StatCard';
import { ActiveSessionQR } from '../components/teacher/ActiveSessionQR';
import { LiveAttendanceFeed } from '../components/teacher/LiveAttendanceFeed';
import { DefaulterList } from '../components/teacher/DefaulterList';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { UserCheck, QrCode, Play, BarChart2, Users, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { generateDemoOtpCode } from '../utils/helpers';

export const TeacherDashboard = () => {
  const { contract, account, addToast } = useWeb3();
  const [subjects, setSubjects] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activeSubject, setActiveSubject] = useState(null);
  const [defaulters, setDefaulters] = useState([]);
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);
  const [avgAttendancePercent, setAvgAttendancePercent] = useState('0');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedSubId, setSelectedSubId] = useState('1');
  const [otpCode, setOtpCode] = useState(() => generateDemoOtpCode());
  const [duration, setDuration] = useState('10');
  const [isStarting, setIsStarting] = useState(false);

  const loadTeacherData = useCallback(async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const subList = await contract.getAllSubjects();
      setSubjects(subList || []);

      const targetSubId = Number(selectedSubId);

      // ── Chart: attendance % across ALL subjects ──────────────────────────
      const stList = await contract.getAllStudents();
      const newChartData = [];

      for (const sub of subList) {
        const subIdNum = Number(sub.id);
        if (!sub.isActive) continue;
        const sessCount = Number(await contract.subjectSessionCount(subIdNum));
        let sumPct = 0, counted = 0;
        for (const st of stList) {
          if (!st.isActive) continue;
          const [tot, att] = await contract.getSubjectAttendanceStats(subIdNum, st.wallet);
          const pct = Number(tot) > 0 ? Math.round((Number(att) * 100) / Number(tot)) : 100;
          sumPct += pct; counted++;
        }
        newChartData.push({
          subject: sub.code,
          attendance: counted > 0 ? Math.round(sumPct / counted) : 0,
        });
      }
      setChartData(newChartData);

      // ── Stats for selected subject ─────────────────────────────────────
      const sub = subList.find(s => Number(s.id) === targetSubId) || subList[0];
      if (sub) {
        setActiveSubject(sub);
        const subSessCount = Number(await contract.subjectSessionCount(sub.id));
        setTotalSessionsCount(subSessCount);

        const defArr = [];
        let sumPct = 0, counted = 0;
        for (const st of stList) {
          if (!st.isActive) continue;
          const [tot, att] = await contract.getSubjectAttendanceStats(sub.id, st.wallet);
          const totalNum = Number(tot), attendedNum = Number(att);
          const pct = totalNum > 0 ? Math.round((attendedNum * 100) / totalNum) : 100;
          sumPct += pct; counted++;
          if (pct < 75) {
            defArr.push({
              wallet: st.wallet,
              name: st.name,
              enrollmentNo: st.enrollmentNo,
              department: st.department,
              percentage: pct,
              attended: attendedNum,
              total: totalNum,
            });
          }
        }
        setDefaulters(defArr);
        if (counted > 0) setAvgAttendancePercent((sumPct / counted).toFixed(1));
      }

      // ── Restore active session if one exists for THIS teacher/subject ──
      try {
        const nextId = Number(await contract.nextSessionId()) - 1;
        if (nextId > 0) {
          const sess = await contract.sessions(nextId);
          const isAssigned = sess && (
            account && sess.teacher.toLowerCase() === account.toLowerCase()
          );
          if (sess && sess.isActive && isAssigned) {
            setActiveSession(prev => {
              if (prev && prev.sessionId === nextId && prev.ephemeralWallet) {
                return prev;
              }
              return {
                sessionId: nextId,
                subjectId: Number(sess.subjectId),
                teacher: sess.teacher,
                otpCode: prev?.otpCode || generateDemoOtpCode(),
                ephemeralWallet: prev?.ephemeralWallet || null,
                startTime: Number(sess.startTime),
                expiryTime: Number(sess.expiryTime),
                totalPresent: Number(sess.totalPresent),
              };
            });
          } else if (sess && !sess.isActive) {
            setActiveSession(null);
          }
        }
      } catch {}
    } catch (err) {
      console.error('Error loading teacher data:', err);
    } finally {
      setLoading(false);
    }
  }, [contract, selectedSubId, account]);

  useEffect(() => { loadTeacherData(); }, [contract, selectedSubId, account]);

  // Immediate event listening for AttendanceMarked & SessionEnded
  useEffect(() => {
    if (!contract || !activeSession?.sessionId) return;
    const sessId = activeSession.sessionId;

    const onAttendanceMarked = (sId) => {
      if (Number(sId) === sessId) {
        setActiveSession(prev => prev ? { ...prev, totalPresent: (prev.totalPresent || 0) + 1 } : prev);
        loadTeacherData();
      }
    };

    const onSessionEnded = (sId) => {
      if (Number(sId) === sessId) {
        setActiveSession(null);
        loadTeacherData();
      }
    };

    try {
      contract.on('AttendanceMarked', onAttendanceMarked);
      contract.on('SessionEnded', onSessionEnded);
    } catch {}

    return () => {
      try {
        contract.off('AttendanceMarked', onAttendanceMarked);
        contract.off('SessionEnded', onSessionEnded);
      } catch {}
    };
  }, [contract, activeSession?.sessionId, loadTeacherData]);

  // Poll present count for active session every 1s for immediate UI feedback
  useEffect(() => {
    if (!contract || !activeSession?.sessionId) return;
    const poll = setInterval(async () => {
      try {
        const s = await contract.sessions(activeSession.sessionId);
        const newPresent = Number(s.totalPresent);
        setActiveSession(prev => {
          if (!prev) return prev;
          if (prev.totalPresent !== newPresent || prev.isActive !== s.isActive) {
            loadTeacherData();
            return { ...prev, totalPresent: newPresent, isActive: s.isActive };
          }
          return prev;
        });
      } catch {}
    }, 1000);
    return () => clearInterval(poll);
  }, [contract, activeSession?.sessionId, loadTeacherData]);

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      setIsStarting(true);

      const ephemeralWallet = ethers.Wallet.createRandom();
      const nextSessId = Number(await contract.nextSessionId());

      const startFn = contract.startSessionWithDemoCode
        ? contract.startSessionWithDemoCode.bind(contract)
        : contract.startSession.bind(contract);

      const tx = await startFn(
        selectedSubId,
        ephemeralWallet.address,
        Number(duration),
        otpCode.trim()
      );
      addToast('Launching session on-chain...', 'info', tx.hash);
      const receipt = await tx.wait();

      let createdSessionId = nextSessId;
      for (const log of (receipt.logs || [])) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'SessionStarted') {
            createdSessionId = Number(parsed.args.sessionId);
            break;
          }
        } catch {}
      }

      const sessStruct = await contract.sessions(createdSessionId);
      const sub = subjects.find(s => s.id.toString() === selectedSubId);
      setActiveSubject(sub);

      setActiveSession({
        sessionId:       createdSessionId,
        subjectId:       Number(selectedSubId),
        otpCode:         otpCode.trim(),
        ephemeralWallet,                         // ← kept in memory, never leaves browser
        startTime:       Number(sessStruct.startTime),
        expiryTime:      Number(sessStruct.expiryTime),
        totalPresent:    0,
      });

      addToast(`🎉 Session #${createdSessionId} live! Rotating ephemeral QR active.`, 'success', receipt.hash);
      loadTeacherData();
    } catch (err) {
      addToast(err.reason || err.message || 'Failed to start session', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndSession = async () => {
    if (!contract || !activeSession) return;
    try {
      const runnerAddr = contract.runner?.address || (contract.runner?.getAddress ? await contract.runner.getAddress() : 'unknown');
      console.log('[handleEndSession] Invoking endSession:', {
        sessionId: activeSession.sessionId,
        contractRunnerAddress: runnerAddr,
        activeAccount: account,
      });

      const tx = await contract.endSession(activeSession.sessionId);
      addToast('Ending session on-chain...', 'info', tx.hash);
      await tx.wait();
      setActiveSession(null);
      setOtpCode(generateDemoOtpCode());
      addToast('Session closed successfully.', 'success');
      loadTeacherData();
    } catch (err) {
      const runnerAddr = contract.runner?.address || (contract.runner?.getAddress ? await contract.runner.getAddress() : 'unknown');
      console.error('[handleEndSession] Failed to end session:', {
        sessionId: activeSession?.sessionId,
        contractRunnerAddress: runnerAddr,
        activeAccount: account,
        reason: err.reason || err.message,
      });
      addToast(err.reason || err.message || 'Failed to end session', 'error');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-white flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-cyan-400" />
            <span>Teacher Live Session Hub</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Start timed sessions with rotating ephemeral-key QR codes — verified on-chain via ecrecover
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Subject Sessions" value={totalSessionsCount} subtitle={`Course: ${activeSubject?.code || '—'}`} icon={QrCode} color="cyan" />
        <StatCard title="Average Attendance" value={`${avgAttendancePercent}%`} subtitle="Enrolled cohort" icon={BarChart2} color="purple" />
        <StatCard title="Defaulters (< 75%)" value={defaulters.length} subtitle="Academic alert required" icon={Users} color="rose" />
      </div>

      {/* Main: Session Control vs Active QR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          {activeSession ? (
            <ActiveSessionQR
              session={activeSession}
              subject={activeSubject}
              onEndSession={handleEndSession}
            />
          ) : (
            <div className="glass-panel p-6 lg:p-8 rounded-3xl border-2 border-cyan-500/30">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-4 w-fit">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rotating Ephemeral-Key Session Launcher</span>
              </div>
              <h3 className="text-xl font-heading font-bold text-white mb-1">Launch New Class Session</h3>
              <p className="text-xs text-slate-400 mb-6">
                Browser generates an ephemeral key pair. Only the public address goes on-chain.
                QR rotates every 20 s — prevents screenshot replay attacks.
              </p>

              <form onSubmit={handleStartSession} className="space-y-4">
                {/* Subject selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Select Subject
                  </label>
                  <select
                    value={selectedSubId}
                    onChange={e => setSelectedSubId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {subjects.filter(s => s.isActive).map((s, idx) => (
                      <option key={idx} value={s.id.toString()}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Demo OTP */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Demo Fallback 6-Digit OTP
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-cyan-500/40 text-center font-mono font-bold text-lg text-cyan-300 focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={duration}
                      onChange={e => setDuration(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-center text-lg focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isStarting}
                  className="w-full py-3.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-neon-cyan transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Ephemeral Key & Deploying Session...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Rotating QR Session</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-5">
          <LiveAttendanceFeed />
        </div>
      </div>

      {/* Chart & Defaulters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-white/10">
          <h3 className="text-base font-heading font-bold text-white mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            <span>Subject Attendance Distribution (%)</span>
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="subject" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#0B0F19', borderColor: 'rgba(0,240,255,0.3)', borderRadius: '12px' }} />
                <Bar dataKey="attendance" fill="url(#neonGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#A855F7" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7">
          <DefaulterList defaulters={defaulters} subjectName={activeSubject?.name || '—'} />
        </div>
      </div>
    </div>
  );
};
