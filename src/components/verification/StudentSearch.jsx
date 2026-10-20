import React, { useState } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { TxHashChip } from '../common/TxHashChip';
import { shortenAddress, formatDate } from '../../utils/helpers';
import { Search, ShieldCheck, UserCheck, Calendar, BookOpen, AlertCircle, Loader2 } from 'lucide-react';

export const StudentSearch = () => {
  const { contract, addToast } = useWeb3();
  const [searchInput, setSearchInput] = useState('TQ2026-CS01');
  const [loading, setLoading] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [records, setRecords] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!contract) {
      addToast('Contract not ready', 'warning');
      return;
    }
    if (!searchInput.trim()) return;

    setLoading(true);
    setSearched(true);
    setStudentInfo(null);
    setRecords([]);

    try {
      let walletAddr = searchInput.trim();
      let stData = null;

      if (walletAddr.startsWith('TQ') || !walletAddr.startsWith('0x')) {
        // Search by Enrollment Number
        const [stStruct, foundAddr] = await contract.getStudentByEnrollment(walletAddr);
        stData = {
          name: stStruct.name,
          enrollmentNo: stStruct.enrollmentNo,
          department: stStruct.department,
          wallet: foundAddr,
        };
        walletAddr = foundAddr;
      } else {
        // Search by wallet address
        const stStruct = await contract.students(walletAddr);
        if (stStruct.isRegistered) {
          stData = {
            name: stStruct.name,
            enrollmentNo: stStruct.enrollmentNo,
            department: stStruct.department,
            wallet: walletAddr,
          };
        }
      }

      setStudentInfo(stData);

      if (walletAddr) {
        const history = await contract.getStudentAttendanceHistory(walletAddr);
        const txMap = {};
        try {
          const filter = contract.filters.AttendanceMarked(null, null, walletAddr);
          const logs = await contract.queryFilter(filter);
          for (const log of logs) {
            const sId = Number(log.args.sessionId);
            txMap[sId] = log.transactionHash;
          }
        } catch (e) {
          console.warn('Could not query AttendanceMarked event logs:', e);
        }

        setRecords((history || []).map(r => ({
          ...r,
          txHash: txMap[Number(r.sessionId)] || null,
        })));
      }
    } catch (err) {
      console.error('Search error:', err);
      addToast('No registered student record found for this query.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input Box */}
      <div className="glass-panel p-6 lg:p-8 rounded-3xl border-2 border-cyan-500/30">
        <div className="max-w-2xl mx-auto text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Public Academic Ledger Verification</span>
          </div>
          <h2 className="text-2xl font-heading font-bold text-white">Verify Student Attendance On-Chain</h2>
          <p className="text-xs text-slate-400 mt-1">
            Search by Enrollment Number (e.g. <strong className="text-cyan-300">TQ2026-CS01</strong>) or Wallet Address
          </p>
        </div>

        <form onSubmit={handleSearch} className="max-w-xl mx-auto flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Enrollment No (TQ2026-CS01) or 0x..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-900/90 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono text-sm transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-neon-cyan transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Verify</span>}
          </button>
        </form>
      </div>

      {/* Verification Results Profile */}
      {studentInfo && (
        <div className="glass-panel p-6 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 animate-fade-in">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 p-0.5 shadow-lg">
                <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-heading font-bold text-white">{studentInfo.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Department: <strong className="text-slate-200">{studentInfo.department}</strong> • Enrollment:{' '}
                  <strong className="text-cyan-300 font-mono">{studentInfo.enrollmentNo}</strong>
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-xs text-slate-400">
              <p>Wallet Address:</p>
              <p className="text-cyan-300 font-semibold">{shortenAddress(studentInfo.wallet)}</p>
            </div>
          </div>

          {/* Attendance History List */}
          <div className="mt-6">
            <h4 className="text-sm font-heading font-bold text-slate-200 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              Verified On-Chain Attendance Log ({records.length} Records)
            </h4>

            {records.length === 0 ? (
              <p className="text-xs text-slate-400">No attendance sessions recorded yet for this student.</p>
            ) : (
              <div className="space-y-3">
                {records.map((rec, idx) => (
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
        </div>
      )}

      {searched && !studentInfo && !loading && (
        <div className="p-8 text-center glass-panel rounded-3xl border border-rose-500/30">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h4 className="text-base font-bold text-white">Record Not Found</h4>
          <p className="text-xs text-slate-400 mt-1">Please check the enrollment number or wallet address and try again.</p>
        </div>
      )}
    </div>
  );
};
