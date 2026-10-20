import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { StatCard } from '../components/common/StatCard';
import { TxHashChip } from '../components/common/TxHashChip';
import { JoinSessionModal } from '../components/student/JoinSessionModal';
import { shortenAddress, formatDate } from '../utils/helpers';
import { Award, BookOpen, QrCode, CheckCircle2, Calendar, UserCheck } from 'lucide-react';

export const StudentDashboard = () => {
  const { contract, account } = useWeb3();
  const [student, setStudent] = useState(null);
  const [history, setHistory] = useState([]);
  const [subjectStats, setSubjectStats] = useState([]);
  const [overallPercent, setOverallPercent] = useState(0);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadStudentData = async () => {
    if (!contract || !account) return;
    try {
      setLoading(true);
      const stStruct = await contract.students(account);
      if (stStruct.isRegistered) {
        setStudent({
          name: stStruct.name,
          enrollmentNo: stStruct.enrollmentNo,
          department: stStruct.department,
          wallet: account,
        });
      } else {
        setStudent({
          name: 'Alex Vance',
          enrollmentNo: 'TQ2026-CS01',
          department: 'Computer Science',
          wallet: account,
        });
      }

      // Fetch student history from contract and correlate with real event log txHashes
      const recs = await contract.getStudentAttendanceHistory(account);
      const txMap = {};
      try {
        const filter = contract.filters.AttendanceMarked(null, null, account);
        const logs = await contract.queryFilter(filter);
        for (const log of logs) {
          const sId = Number(log.args.sessionId);
          txMap[sId] = log.transactionHash;
        }
      } catch (e) {
        console.warn('Could not query AttendanceMarked event logs:', e);
      }

      setHistory((recs || []).map(r => ({
        ...r,
        txHash: txMap[Number(r.sessionId)] || null,
      })));

      // Fetch per-subject attendance stats dynamically
      const subs = await contract.getAllSubjects();
      let totalAttendedAll = 0;
      let totalSessionsAll = 0;
      const stats = [];

      for (const sub of subs) {
        const [totalSess, attendedSess] = await contract.getSubjectAttendanceStats(sub.id, account);
        const totalNum = Number(totalSess);
        const attendedNum = Number(attendedSess);
        const pct = totalNum > 0 ? Math.round((attendedNum * 100) / totalNum) : 100;

        totalAttendedAll += attendedNum;
        totalSessionsAll += totalNum;

        stats.push({
          code: sub.code,
          name: sub.name,
          total: totalNum,
          attended: attendedNum,
          percent: pct,
        });
      }

      setSubjectStats(stats);
      if (totalSessionsAll > 0) {
        setOverallPercent(Math.round((totalAttendedAll * 100) / totalSessionsAll));
      } else {
        setOverallPercent(100);
      }
    } catch (err) {
      console.error('Error loading student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [contract, account]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-white flex items-center gap-3">
            <Award className="w-8 h-8 text-emerald-400" />
            <span>Student Academic Portal</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track attendance percentage and verify signed check-ins</p>
        </div>

        <button
          onClick={() => setIsJoinModalOpen(true)}
          className="px-6 py-3.5 rounded-2xl font-heading font-bold text-xs bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-neon-cyan transition-all flex items-center gap-2 group"
        >
          <QrCode className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          <span>Scan QR / Check in</span>
        </button>
      </div>

      {/* Student Identity Card */}
      {student && (
        <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/20 via-purple-950/20 to-slate-900/60">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 shadow-neon-cyan">
                <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center">
                  <UserCheck className="w-7 h-7 text-cyan-300" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-heading font-bold text-white">{student.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enrollment ID: <strong className="text-cyan-300 font-mono">{student.enrollmentNo}</strong> • Department:{' '}
                  <strong className="text-slate-200">{student.department}</strong>
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <span className="text-slate-400 block">Connected Wallet Signature</span>
              <span className="text-cyan-300 font-bold">{shortenAddress(account)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Overall Attendance %" value={`${overallPercent}%`} subtitle="Enrolled courses aggregate" icon={Award} color={overallPercent >= 75 ? 'emerald' : 'rose'} />
        <StatCard title="Total Classes Attended" value={history.length} subtitle="On-chain verified entries" icon={CheckCircle2} color="cyan" />
        <StatCard title="Active Courses" value={subjectStats.length} subtitle="Enrolled subjects" icon={BookOpen} color="purple" />
      </div>

      {/* Subject-Wise Attendance Progress */}
      <div className="glass-panel p-6 lg:p-8 rounded-3xl border border-white/10">
        <h3 className="text-lg font-heading font-bold text-white mb-4">Subject Attendance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subjectStats.map((sub, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold">
                  {sub.code}
                </span>
                <span className={`text-sm font-bold ${sub.percent >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {sub.percent}%
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">{sub.name}</h4>
              <p className="text-xs text-slate-400">
                Attended: <strong className="text-white">{sub.attended}</strong> / {sub.total} Sessions
              </p>

              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    sub.percent >= 75
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      : 'bg-gradient-to-r from-rose-500 to-orange-400'
                  }`}
                  style={{ width: `${sub.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History Log Table */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10">
        <h3 className="text-lg font-heading font-bold text-white mb-4">On-Chain Attendance History</h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400">No attendance records found yet. Click &quot;Scan QR / Check in&quot; to mark attendance.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {history.map((rec, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-cyan-500/30 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{rec.subjectName}</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono text-[10px]">
                      {rec.subjectCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Session #{rec.sessionId?.toString()} • {formatDate(rec.timestamp)}
                  </p>
                </div>

                <TxHashChip txHash={rec.txHash} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Check-in Modal */}
      <JoinSessionModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={loadStudentData}
      />
    </div>
  );
};
