import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { StatCard } from '../components/common/StatCard';
import { shortenAddress } from '../utils/helpers';
import {
  Shield, UserPlus, BookPlus, Users, Award, BookOpen,
  UserX, AlertTriangle, X, Loader2
} from 'lucide-react';

// ── Confirmation Dialog ────────────────────────────────────────────────────
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel max-w-md w-full p-6 rounded-3xl border-2 border-rose-500/40 shadow-2xl relative">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-1">{message}</p>
          </div>
          <button onClick={onCancel} className="ml-auto p-1 text-slate-400 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
            <span>Confirm Deactivate</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Status badge ────────────────────────────────────────────────────────────
const ActiveBadge = ({ isActive }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
    isActive
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
    {isActive ? 'Active' : 'Deactivated'}
  </span>
);

export const AdminDashboard = () => {
  const { contract, addToast } = useWeb3();
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);

  // Confirm dialog state
  const [dialog, setDialog] = useState({ open: false, type: null, target: null, label: '' });
  const [dialogLoading, setDialogLoading] = useState(false);

  // Register Teacher form
  const [tWallet, setTWallet] = useState('');
  const [tName, setTName]     = useState('');
  const [tDept, setTDept]     = useState('Computer Science');

  // Register Student form
  const [sWallet, setSWallet]         = useState('');
  const [sEnrollment, setSEnrollment] = useState('');
  const [sName, setSName]             = useState('');
  const [sDept, setSDept]             = useState('Computer Science');

  // Create Subject form
  const [subName, setSubName]       = useState('');
  const [subCode, setSubCode]       = useState('');
  const [subTeacher, setSubTeacher] = useState('');

  const loadAdminData = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const [tList, sList, subList] = await Promise.all([
        contract.getAllTeachers(),
        contract.getAllStudents(),
        contract.getAllSubjects(),
      ]);
      setTeachers(tList || []);
      setStudents(sList || []);
      setSubjects(subList || []);
      if (tList?.length > 0) setSubTeacher(tList[0].wallet);
    } catch (err) {
      console.error('Admin data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdminData(); }, [contract]);

  // ── Register handlers ────────────────────────────────────────────────────
  const handleRegisterTeacher = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const tx = await contract.registerTeacher(tWallet, tName, tDept);
      addToast('Registering teacher on-chain...', 'info', tx.hash);
      await tx.wait();
      addToast(`Teacher ${tName} successfully registered!`, 'success');
      setTWallet(''); setTName('');
      loadAdminData();
    } catch (err) {
      addToast(err.reason || err.message || 'Failed to register teacher', 'error');
    }
  };

  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const tx = await contract.registerStudent(sWallet, sEnrollment, sName, sDept);
      addToast('Registering student on-chain...', 'info', tx.hash);
      await tx.wait();
      addToast(`Student ${sName} (${sEnrollment}) registered!`, 'success');
      setSWallet(''); setSEnrollment(''); setSName('');
      loadAdminData();
    } catch (err) {
      addToast(err.reason || err.message || 'Failed to register student', 'error');
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const tx = await contract.createSubject(subName, subCode, subTeacher);
      addToast('Creating subject on-chain...', 'info', tx.hash);
      await tx.wait();
      addToast(`Subject ${subCode} (${subName}) created!`, 'success');
      setSubName(''); setSubCode('');
      loadAdminData();
    } catch (err) {
      addToast(err.reason || err.message || 'Failed to create subject', 'error');
    }
  };

  // ── Deactivate flow ───────────────────────────────────────────────────────
  const openConfirm = (type, target, label) => {
    setDialog({ open: true, type, target, label });
  };

  const handleConfirmDeactivate = async () => {
    if (!contract || !dialog.target) return;
    setDialogLoading(true);
    try {
      let tx;
      if (dialog.type === 'teacher') {
        tx = await contract.removeTeacher(dialog.target);
        addToast('Deactivating teacher on-chain...', 'info', tx.hash);
      } else if (dialog.type === 'student') {
        tx = await contract.removeStudent(dialog.target);
        addToast('Deactivating student on-chain...', 'info', tx.hash);
      } else if (dialog.type === 'subject') {
        tx = await contract.removeSubject(dialog.target);
        addToast('Deactivating subject on-chain...', 'info', tx.hash);
      }
      await tx.wait();
      addToast(`${dialog.label} has been deactivated. Past records are preserved.`, 'success');
      setDialog({ open: false, type: null, target: null, label: '' });
      loadAdminData();
    } catch (err) {
      addToast(err.reason || err.message || 'Deactivation failed', 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  const activeTeachers  = teachers.filter(t => t.isActive).length;
  const activeStudents  = students.filter(s => s.isActive).length;
  const activeSubjects  = subjects.filter(s => s.isActive).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={dialog.open}
        title={`Deactivate ${dialog.type?.charAt(0).toUpperCase() + dialog.type?.slice(1) || ''}`}
        message={`Are you sure you want to deactivate "${dialog.label}"? Their past records will be preserved on-chain, but they cannot start sessions or mark attendance.`}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDialog({ open: false, type: null, target: null, label: '' })}
        loading={dialogLoading}
      />

      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-400" />
            <span>Admin System Control Portal</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Register and manage faculty, students, and subjects on-chain
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Active Faculty" value={activeTeachers} subtitle={`${teachers.length} total registered`} icon={Users} color="purple" />
        <StatCard title="Active Students" value={activeStudents} subtitle={`${students.length} total enrolled`} icon={Award} color="cyan" />
        <StatCard title="Active Subjects" value={activeSubjects} subtitle={`${subjects.length} total created`} icon={BookOpen} color="emerald" />
      </div>

      {/* Registration Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Register Teacher */}
        <div className="glass-panel p-6 rounded-3xl border border-purple-500/30">
          <h3 className="text-lg font-heading font-bold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-purple-400" />
            <span>Register Faculty</span>
          </h3>
          <form onSubmit={handleRegisterTeacher} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Wallet Address</label>
              <input type="text" value={tWallet} onChange={e => setTWallet(e.target.value)}
                placeholder="0x..." required
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Faculty Name</label>
              <input type="text" value={tName} onChange={e => setTName(e.target.value)}
                placeholder="Dr. Alan Turing" required
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Department</label>
              <input type="text" value={tDept} onChange={e => setTDept(e.target.value)} required
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
              />
            </div>
            <button type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-neon-purple transition-all">
              Register Teacher
            </button>
          </form>
        </div>

        {/* Register Student */}
        <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30">
          <h3 className="text-lg font-heading font-bold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            <span>Register Student</span>
          </h3>
          <form onSubmit={handleRegisterStudent} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Wallet Address</label>
              <input type="text" value={sWallet} onChange={e => setSWallet(e.target.value)}
                placeholder="0x..." required
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Enrollment Number</label>
              <input type="text" value={sEnrollment} onChange={e => setSEnrollment(e.target.value)}
                placeholder="TQ2026-CS06" required
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Student Name</label>
              <input type="text" value={sName} onChange={e => setSName(e.target.value)}
                placeholder="Maya Lin" required
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <button type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-neon-cyan transition-all">
              Register Student
            </button>
          </form>
        </div>

        {/* Create Subject */}
        <div className="glass-panel p-6 rounded-3xl border border-emerald-500/30">
          <h3 className="text-lg font-heading font-bold text-white mb-4 flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-emerald-400" />
            <span>Create Subject</span>
          </h3>
          <form onSubmit={handleCreateSubject} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Subject Name</label>
              <input type="text" value={subName} onChange={e => setSubName(e.target.value)}
                placeholder="Distributed Systems" required
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Subject Code</label>
              <input type="text" value={subCode} onChange={e => setSubCode(e.target.value)}
                placeholder="CS-502" required
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Assigned Faculty</label>
              <select value={subTeacher} onChange={e => setSubTeacher(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400">
                {teachers.filter(t => t.isActive).map((t, idx) => (
                  <option key={idx} value={t.wallet}>{t.name} ({shortenAddress(t.wallet)})</option>
                ))}
              </select>
            </div>
            <button type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
              Create Subject
            </button>
          </form>
        </div>
      </div>

      {/* Faculty Table */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10">
        <h3 className="text-base font-heading font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <span>Registered Faculty ({teachers.length})</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase">
                <th className="pb-3">Faculty Name</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Wallet Address</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {teachers.map((t, idx) => (
                <tr key={idx} className={`hover:bg-white/5 transition-colors ${!t.isActive ? 'opacity-50' : ''}`}>
                  <td className="py-3 font-semibold text-white">{t.name}</td>
                  <td className="py-3 text-slate-400">{t.department}</td>
                  <td className="py-3 font-mono text-cyan-300">{shortenAddress(t.wallet)}</td>
                  <td className="py-3 text-center"><ActiveBadge isActive={t.isActive} /></td>
                  <td className="py-3 text-right">
                    {t.isActive && (
                      <button
                        onClick={() => openConfirm('teacher', t.wallet, t.name)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all flex items-center gap-1 ml-auto"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">No faculty registered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Students Table */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10">
        <h3 className="text-base font-heading font-bold text-white mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-cyan-400" />
          <span>Enrolled Students ({students.length})</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase">
                <th className="pb-3">Student Name</th>
                <th className="pb-3">Enrollment No</th>
                <th className="pb-3">Wallet Address</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {students.map((st, idx) => (
                <tr key={idx} className={`hover:bg-white/5 transition-colors ${!st.isActive ? 'opacity-50' : ''}`}>
                  <td className="py-3 font-semibold text-white">{st.name}</td>
                  <td className="py-3 font-mono text-cyan-300">{st.enrollmentNo}</td>
                  <td className="py-3 font-mono text-slate-400">{shortenAddress(st.wallet)}</td>
                  <td className="py-3 text-center"><ActiveBadge isActive={st.isActive} /></td>
                  <td className="py-3 text-right">
                    {st.isActive && (
                      <button
                        onClick={() => openConfirm('student', st.wallet, `${st.name} (${st.enrollmentNo})`)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all flex items-center gap-1 ml-auto"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">No students enrolled yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10">
        <h3 className="text-base font-heading font-bold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span>Subjects ({subjects.length})</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase">
                <th className="pb-3">Code</th>
                <th className="pb-3">Subject Name</th>
                <th className="pb-3">Assigned Teacher</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={`hover:bg-white/5 transition-colors ${!sub.isActive ? 'opacity-50' : ''}`}>
                  <td className="py-3 font-mono text-cyan-300 font-bold">{sub.code}</td>
                  <td className="py-3 font-semibold text-white">{sub.name}</td>
                  <td className="py-3 font-mono text-slate-400">{shortenAddress(sub.teacher)}</td>
                  <td className="py-3 text-center"><ActiveBadge isActive={sub.isActive} /></td>
                  <td className="py-3 text-right">
                    {sub.isActive && (
                      <button
                        onClick={() => openConfirm('subject', Number(sub.id), `${sub.code} — ${sub.name}`)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all flex items-center gap-1 ml-auto"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {subjects.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">No subjects created yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
