import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckSquare, Circle, CheckCircle2, Clock, AlertCircle, 
  ChevronDown, MoreVertical, Trash2, Calendar, Flag 
} from 'lucide-react';
import { Action, VoiceNote } from '../types';
import { formatDistanceToNow, format, isToday, isTomorrow, isPast } from 'date-fns';
import { priorityColors } from '../theme';

interface ActionsHubProps {
  actions: Action[];
  notes: VoiceNote[];
  onActionToggle: (id: string, status: 'pending' | 'completed' | 'dismissed') => void;
  onActionDelete: (id: string) => void;
  onActionUpdate: (id: string, updates: Partial<Action>) => void;
  onNoteSelect: (noteId: string) => void;
}

type FilterType = 'all' | 'pending' | 'completed' | 'overdue';

const ActionsHub: React.FC<ActionsHubProps> = ({
  actions,
  notes,
  onActionToggle,
  onActionDelete,
  onActionUpdate,
  onNoteSelect,
}) => {
  const [filter, setFilter] = useState<FilterType>('pending');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const filterActions = (actionList: Action[]) => {
    switch (filter) {
      case 'pending':
        return actionList.filter(a => a.status === 'pending');
      case 'completed':
        return actionList.filter(a => a.status === 'completed');
      case 'overdue':
        return actionList.filter(a => 
          a.status === 'pending' && a.dueDate && isPast(new Date(a.dueDate))
        );
      default:
        return actionList;
    }
  };

  const filteredActions = filterActions(actions);
  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const overdueCount = actions.filter(a => 
    a.status === 'pending' && a.dueDate && isPast(new Date(a.dueDate))
  ).length;

  const getNoteTitle = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    return note?.title || note?.transcript?.substring(0, 30) || 'Untitled Note';
  };

  const formatDueDate = (timestamp?: number) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const ActionCard: React.FC<{ action: Action }> = ({ action }) => {
    const isExpanded = expandedAction === action.id;
    const isOverdue = action.dueDate && isPast(new Date(action.dueDate)) && action.status === 'pending';

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className={`bg-terminal-surface border rounded-xl overflow-hidden transition-all ${
          action.status === 'completed' 
            ? 'border-green-500/20 opacity-60' 
            : isOverdue 
              ? 'border-red-500/30' 
              : 'border-white/5'
        }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            <button
              onClick={() => onActionToggle(
                action.id, 
                action.status === 'completed' ? 'pending' : 'completed'
              )}
              className="mt-0.5 flex-shrink-0"
            >
              {action.status === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <Circle className={`w-6 h-6 ${isOverdue ? 'text-red-400' : 'text-neutral-500'} hover:text-indigo-400 transition-colors`} />
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-base ${action.status === 'completed' ? 'line-through text-neutral-500' : 'text-slate-100'}`}>
                {action.content}
              </p>

              {/* Metadata */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {/* Priority */}
                <span 
                  className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ 
                    backgroundColor: `${priorityColors[action.priority]}15`,
                    color: priorityColors[action.priority]
                  }}
                >
                  <Flag className="w-3 h-3" />
                  {action.priority}
                </span>

                {/* Due Date */}
                {action.dueDate && (
                  <span className={`flex items-center gap-1 text-xs ${
                    isOverdue ? 'text-red-400' : 'text-neutral-500'
                  }`}>
                    <Calendar className="w-3 h-3" />
                    {formatDueDate(action.dueDate)}
                  </span>
                )}

                {/* Source Note */}
                <button
                  onClick={() => onNoteSelect(action.noteId)}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  View note →
                </button>
              </div>
            </div>

            {/* Actions Menu */}
            <button
              onClick={() => setExpandedAction(isExpanded ? null : action.id)}
              className="p-1 text-neutral-500 hover:text-white"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Expanded Actions */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 pt-4 border-t border-terminal-border flex gap-2 flex-wrap"
              >
                {/* Priority buttons */}
                {(['low', 'medium', 'high'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => onActionUpdate(action.id, { priority: p })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      action.priority === p 
                        ? 'ring-2 ring-white' 
                        : 'bg-terminal-hover'
                    }`}
                    style={{ 
                      backgroundColor: action.priority === p ? priorityColors[p] : undefined,
                      color: action.priority === p ? 'white' : priorityColors[p]
                    }}
                  >
                    {p}
                  </button>
                ))}

                <div className="flex-1" />

                <button
                  onClick={() => onActionToggle(action.id, 'dismissed')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-terminal-hover text-neutral-200 hover:bg-terminal-hover"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => onActionDelete(action.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 flex flex-col pb-32">
      {/* Header */}
      <div className="px-4 pt-2 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Actions</h1>
            <p className="text-sm text-neutral-500 mt-1">Tasks extracted from your notes</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-rgb-cyan/10 text-indigo-400 rounded-full text-sm font-medium">
                {pendingCount} pending
              </span>
              {overdueCount > 0 && (
                <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-sm font-medium">
                  {overdueCount} overdue
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'pending', label: 'Pending', icon: Circle },
            { id: 'completed', label: 'Done', icon: CheckCircle2 },
            { id: 'overdue', label: 'Overdue', icon: AlertCircle },
            { id: 'all', label: 'All', icon: CheckSquare },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as FilterType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-rgb-cyan text-white'
                  : 'bg-terminal-surface text-neutral-400 hover:bg-terminal-surface'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions List */}
      <div className="flex-1 overflow-y-auto px-4">
        {filteredActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <div className="w-20 h-20 rounded-full bg-terminal-surface flex items-center justify-center mb-6">
              <CheckSquare className="w-10 h-10 text-neutral-600" />
            </div>
            {filter === 'pending' ? (
              <>
                <p className="text-lg font-medium text-neutral-400">All caught up!</p>
                <p className="text-sm text-neutral-500 mt-1">No pending actions</p>
              </>
            ) : filter === 'overdue' ? (
              <>
                <p className="text-lg font-medium text-neutral-400">No overdue tasks</p>
                <p className="text-sm text-neutral-500 mt-1">You're on track!</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-neutral-400">No actions yet</p>
                <p className="text-sm text-neutral-500 mt-1">Tasks from your notes will appear here</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            <AnimatePresence mode="popLayout">
              {filteredActions.map(action => (
                <ActionCard key={action.id} action={action} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionsHub;
