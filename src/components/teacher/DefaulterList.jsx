import React from 'react';
import { exportToCSV, shortenAddress } from '../../utils/helpers';
import { AlertTriangle, FileSpreadsheet, Download, ShieldAlert } from 'lucide-react';

export const DefaulterList = ({ defaulters = [], subjectName = 'CS-401' }) => {
  const handleExportCSV = () => {
    const headers = [
      { label: 'Student Address', key: 'wallet' },
      { label: 'Enrollment Number', key: 'enrollmentNo' },
      { label: 'Student Name', key: 'name' },
      { label: 'Department', key: 'dept' },
      { label: 'Attendance %', key: 'percentage' },
      { label: 'Status', key: 'status' },
    ];

    const rows = defaulters.map(d => ({
      wallet: d.wallet,
      enrollmentNo: d.enrollmentNo || 'TQ2026-CS03',
      name: d.name || 'Marcus Thorne',
      dept: d.department || 'Computer Science',
      percentage: `${d.percentage || 0}%`,
      status: 'DEFAULTER (<75%)',
    }));

    exportToCSV(`Defaulter_List_${subjectName.replace(/\s+/g, '_')}.csv`, rows, headers);
  };

  return (
    <div className="glass-panel p-6 rounded-3xl border border-rose-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <h3 className="text-lg font-heading font-bold text-white">Defaulter List (&lt; 75% Attendance)</h3>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={!defaulters || defaulters.length === 0}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Export CSV</span>
        </button>
      </div>

      {!defaulters || defaulters.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-white/10 rounded-2xl">
          <p className="text-sm text-slate-400">🎉 No defaulters found! All enrolled students have &gt;= 75% attendance.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase">
                <th className="pb-3 px-2">Student Name</th>
                <th className="pb-3 px-2">Enrollment</th>
                <th className="pb-3 px-2">Wallet Address</th>
                <th className="pb-3 px-2">Attendance %</th>
                <th className="pb-3 px-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {defaulters.map((st, idx) => (
                <tr key={idx} className="hover:bg-rose-500/5 transition-colors">
                  <td className="py-3 px-2 font-semibold text-white">{st.name || 'Marcus Thorne'}</td>
                  <td className="py-3 px-2 font-mono text-cyan-300">{st.enrollmentNo || 'TQ2026-CS03'}</td>
                  <td className="py-3 px-2 font-mono text-slate-400">{shortenAddress(st.wallet)}</td>
                  <td className="py-3 px-2 font-bold text-rose-400">{st.percentage || 0}%</td>
                  <td className="py-3 px-2 text-right">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase">
                      Action Required
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
