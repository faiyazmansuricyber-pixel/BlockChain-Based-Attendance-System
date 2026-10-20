import React from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { TxHashChip } from './TxHashChip';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useWeb3();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
      {toasts.map(toast => {
        let icon = <Info className="w-5 h-5 text-cyan-400" />;
        let borderClass = 'border-cyan-500/40 bg-slate-900/90';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
          borderClass = 'border-emerald-500/40 bg-emerald-950/80 shadow-lg shadow-emerald-950/50';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-5 h-5 text-rose-400" />;
          borderClass = 'border-rose-500/40 bg-rose-950/80 shadow-lg shadow-rose-950/50';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-5 h-5 text-amber-400" />;
          borderClass = 'border-amber-500/40 bg-amber-950/80 shadow-lg shadow-amber-950/50';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl backdrop-blur-xl border ${borderClass} text-slate-100 transition-all duration-300 animate-slide-in`}
          >
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1 text-sm font-medium">
              <p>{toast.message}</p>
              {toast.txHash && (
                <div className="mt-2">
                  <TxHashChip txHash={toast.txHash} />
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
