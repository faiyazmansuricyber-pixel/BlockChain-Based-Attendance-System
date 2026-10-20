import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'cyan', badgeText }) => {
  const colorMap = {
    cyan: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-400 shadow-neon-cyan',
    purple: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400 shadow-neon-purple',
    emerald: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
    amber: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
    rose: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400',
  };

  const selectedColor = colorMap[color] || colorMap.cyan;

  return (
    <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-400/40 transition-all duration-300">
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-gradient-to-br ${selectedColor} blur-2xl opacity-40 group-hover:opacity-70 transition-opacity`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
          <h3 className="text-3xl font-heading font-bold text-white tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1.5 font-medium">{subtitle}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          {Icon && (
            <div className={`p-3 rounded-xl bg-white/5 border border-white/10 ${selectedColor.split(' ')[2]} group-hover:scale-110 transition-transform`}>
              <Icon className="w-6 h-6" />
            </div>
          )}
          {badgeText && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {badgeText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
