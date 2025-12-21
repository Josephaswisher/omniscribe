import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Mic, Clock, FileText, CheckCircle, 
  TrendingUp, Calendar, Zap 
} from 'lucide-react';
import { VoiceNote, Action, Parser } from '../types';
import { format, subDays, startOfDay, isWithinInterval } from 'date-fns';

interface AnalyticsViewProps {
  notes: VoiceNote[];
  actions: Action[];
  parsers: Parser[];
  onBack: () => void;
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ notes, actions, parsers, onBack }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i);
      return {
        date: startOfDay(date),
        label: format(date, 'EEE'),
        count: 0,
        duration: 0,
      };
    });

    // Calculate daily stats
    notes.forEach(note => {
      const noteDate = startOfDay(new Date(note.createdAt));
      const dayEntry = last7Days.find(d => d.date.getTime() === noteDate.getTime());
      if (dayEntry) {
        dayEntry.count++;
        dayEntry.duration += note.duration;
      }
    });

    // Total stats
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);
    const totalWords = notes.reduce((sum, n) => sum + (n.wordCount || 0), 0);
    
    // Completed actions
    const completedActions = actions.filter(a => a.status === 'completed').length;
    const pendingActions = actions.filter(a => a.status === 'pending').length;
    const actionCompletionRate = actions.length > 0 
      ? Math.round((completedActions / actions.length) * 100) 
      : 0;

    // Parser usage
    const parserCounts: Record<string, number> = {};
    notes.forEach(note => {
      parserCounts[note.parserId] = (parserCounts[note.parserId] || 0) + 1;
    });
    const parserUsage = Object.entries(parserCounts)
      .map(([id, count]) => ({
        parser: parsers.find(p => p.id === id)?.name || id,
        count,
        percentage: Math.round((count / notes.length) * 100) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate streak
    let streak = 0;
    let checkDate = startOfDay(now);
    while (true) {
      const hasNote = notes.some(n => 
        startOfDay(new Date(n.createdAt)).getTime() === checkDate.getTime()
      );
      if (hasNote) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    // Max for chart scaling
    const maxDailyCount = Math.max(...last7Days.map(d => d.count), 1);

    return {
      totalNotes: notes.length,
      totalDuration,
      totalWords,
      completedActions,
      pendingActions,
      actionCompletionRate,
      parserUsage,
      streak,
      last7Days,
      maxDailyCount,
      avgDuration: notes.length > 0 ? Math.round(totalDuration / notes.length) : 0,
    };
  }, [notes, actions, parsers]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const StatCard: React.FC<{
    icon: React.ElementType;
    label: string;
    value: string | number;
    subtext?: string;
    color: string;
  }> = ({ icon: Icon, label, value, subtext, color }) => (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
    </div>
  );

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-900"
    >
      {/* Header */}
      <header className="safe-top px-4 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-bold text-white">Analytics</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto safe-bottom p-4 space-y-6">
        {/* Streak Banner */}
        {stats.streak > 0 && (
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/30 flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">{stats.streak} Day Streak!</div>
              <div className="text-sm text-amber-200/70">Keep recording daily</div>
            </div>
          </div>
        )}

        {/* Key Stats Grid */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Mic}
              label="Total Notes"
              value={stats.totalNotes}
              color="bg-indigo-500"
            />
            <StatCard
              icon={Clock}
              label="Recording Time"
              value={formatDuration(stats.totalDuration)}
              subtext={`~${stats.avgDuration}s avg`}
              color="bg-cyan-500"
            />
            <StatCard
              icon={FileText}
              label="Total Words"
              value={stats.totalWords.toLocaleString()}
              color="bg-purple-500"
            />
            <StatCard
              icon={CheckCircle}
              label="Actions Done"
              value={`${stats.actionCompletionRate}%`}
              subtext={`${stats.completedActions}/${stats.completedActions + stats.pendingActions}`}
              color="bg-green-500"
            />
          </div>
        </section>

        {/* Activity Chart */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Last 7 Days
          </h2>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-end justify-between h-32 gap-2">
              {stats.last7Days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end h-24">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(day.count / stats.maxDailyCount) * 100}%` }}
                      transition={{ delay: i * 0.05 }}
                      className={`w-full rounded-t-md ${
                        day.count > 0 ? 'bg-indigo-500' : 'bg-slate-700'
                      }`}
                      style={{ minHeight: day.count > 0 ? 8 : 4 }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{day.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between text-sm">
              <span className="text-slate-500">This week</span>
              <span className="text-white font-medium">
                {stats.last7Days.reduce((sum, d) => sum + d.count, 0)} notes
              </span>
            </div>
          </div>
        </section>

        {/* Parser Usage */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Parser Usage
          </h2>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
            {stats.parserUsage.length > 0 ? (
              stats.parserUsage.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{item.parser}</span>
                    <span className="text-slate-500">{item.count} notes</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      transition={{ delay: i * 0.1 }}
                      className="h-full bg-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 py-4">
                No notes recorded yet
              </div>
            )}
          </div>
        </section>

        {/* Tips */}
        <section className="pb-8">
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">Pro Tip</h3>
                <p className="text-xs text-slate-500">
                  Try recording at the same time each day to build a consistent habit. 
                  Morning voice notes are great for planning your day!
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </motion.div>
  );
};

export default AnalyticsView;
