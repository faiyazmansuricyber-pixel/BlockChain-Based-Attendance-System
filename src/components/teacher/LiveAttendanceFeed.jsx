import React from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { TxHashChip } from '../common/TxHashChip';
import { shortenAddress, formatDate } from '../../utils/helpers';
import { Activity, Radio, UserCheck, PlayCircle, Clock } from 'lucide-react';

export const LiveAttendanceFeed = () => {
  const { eventsFeed } = useWeb3();

  return (
    <div className="glass-panel p-6 rounded-3xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-heading font-bold text-white">Live On-Chain Event Feed</h3>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Listening to Hardhat Events</span>
        </div>
      </div>

      {!eventsFeed || eventsFeed.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl">
          <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2 animate-spin" style={{ animationDuration: '6s' }} />
          <p className="text-sm text-slate-400 font-medium">Waiting for live contract events...</p>
          <p className="text-xs text-slate-500 mt-1">Events will emit automatically when sessions start or students check in.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {eventsFeed.map((ev, idx) => {
            if (ev.type === 'SessionStarted') {
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 hover:border-purple-400/60 transition-all flex items-start justify-between gap-3 animate-fade-in"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 mt-0.5">
                      <PlayCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-purple-200">{ev.title}</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Subject ID: <strong className="text-purple-300">#{ev.subjectId}</strong> • Session ID: <strong className="text-purple-300">#{ev.sessionId}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Teacher: <span className="font-mono text-purple-300/80">{shortenAddress(ev.teacher)}</span> • Expiry: {formatDate(ev.expiryTime)}
                      </p>
                    </div>
                  </div>
                  <TxHashChip txHash={ev.txHash} />
                </div>
              );
            }

            // AttendanceMarked Event
            return (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-900/60 border border-cyan-500/20 hover:border-cyan-400/40 transition-all flex items-start justify-between gap-3 animate-fade-in"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 mt-0.5">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{ev.title}</h4>
                    <p className="text-xs text-cyan-300 font-semibold mt-0.5">
                      {ev.student || shortenAddress(ev.studentAddr)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Session ID: #{ev.sessionId} • {formatDate(ev.timestamp)}
                    </p>
                  </div>
                </div>
                <TxHashChip txHash={ev.txHash} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
