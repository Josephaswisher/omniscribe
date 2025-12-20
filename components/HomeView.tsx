import React from 'react';
import { motion } from 'framer-motion';
import { Pin, MoreVertical, Clock, FileText, Trash2, FolderOpen, Calendar } from 'lucide-react';
import { VoiceNote, Parser, Folder, Tag as TagType } from '../types';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

interface HomeViewProps {
  notes: VoiceNote[];
  parsers: Parser[];
  folders: Folder[];
  tags: TagType[];
  onNoteSelect: (note: VoiceNote) => void;
  onNoteDelete: (id: string) => void;
  onNotePin: (id: string) => void;
  onRetry: (note: VoiceNote) => void;
  isSyncing?: boolean;
}

const HomeView: React.FC<HomeViewProps> = ({
  notes,
  parsers,
  folders,
  onNoteSelect,
  onNoteDelete,
  onNotePin,
  onRetry,
  isSyncing,
}) => {
  const getParserName = (id: string) => parsers.find(p => p.id === id)?.name || 'Raw';
  const getFolderName = (id?: string) => id ? folders.find(f => f.id === id)?.name : null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy · h:mm a');
    }
  };

  const pinnedNotes = notes.filter(n => n.isPinned);
  const recentNotes = notes.filter(n => !n.isPinned);

  const NoteCard: React.FC<{ note: VoiceNote }> = ({ note }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onClick={() => onNoteSelect(note)}
      className="group relative card-module p-4 transition-all cursor-pointer hover:border-terminal-muted"
    >
      {/* Pin indicator */}
      {note.isPinned && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-rgb-yellow rounded-full flex items-center justify-center shadow-lg glow-yellow">
          <Pin className="w-3 h-3 text-black" />
        </div>
      )}

      {/* Date/Time - Terminal style */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-3 h-3 text-rgb-cyan" />
        <span className="font-mono text-[11px] text-neutral-500">
          {formatDateTime(note.createdAt)}
        </span>
      </div>

      {/* Title / Preview */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-neutral-100 font-semibold text-base leading-snug line-clamp-2">
          {note.title || (
            <span className="text-neutral-500 italic font-normal">
              {note.status === 'processing' ? 'Processing...' : 'Untitled Recording'}
            </span>
          )}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-white transition-opacity"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Transcript preview */}
      {note.transcript && (
        <p className="text-neutral-500 text-sm line-clamp-2 mb-3 leading-relaxed">
          {note.transcript.substring(0, 120)}...
        </p>
      )}

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {note.tags.slice(0, 3).map(tag => (
            <span
              key={tag.id}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border"
              style={{ 
                backgroundColor: `${tag.color}15`, 
                color: tag.color,
                borderColor: `${tag.color}30`
              }}
            >
              #{tag.name}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-terminal-hover text-neutral-400 border border-terminal-border">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Metadata Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-neutral-600 font-mono">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-rgb-green" />
            {formatDuration(note.duration)}
          </span>
          {note.wordCount && (
            <span className="flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-rgb-blue" />
              {note.wordCount} words
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status */}
          {note.status === 'processing' && (
            <span className="flex items-center gap-1.5 text-rgb-cyan bg-rgb-cyan/10 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border border-rgb-cyan/20">
              <span className="w-1.5 h-1.5 bg-rgb-cyan rounded-full animate-pulse" />
              PROCESSING
            </span>
          )}
          {note.status === 'error' && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(note); }}
              className="text-rgb-red bg-rgb-red/10 px-2 py-0.5 rounded text-[10px] font-mono font-semibold hover:bg-rgb-red/20 border border-rgb-red/20"
            >
              RETRY
            </button>
          )}
          {note.status === 'pending' && (
            <span className="text-rgb-yellow bg-rgb-yellow/10 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border border-rgb-yellow/20">
              OFFLINE
            </span>
          )}

          {/* Parser badge */}
          <span className="bg-terminal-hover px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide text-neutral-400 border border-terminal-border">
            {getParserName(note.parserId)}
          </span>
        </div>
      </div>

      {/* Folder indicator */}
      {note.folderId && (
        <div className="mt-3 pt-3 border-t border-terminal-border flex items-center gap-2 text-xs text-neutral-500 font-mono">
          <FolderOpen className="w-3 h-3 text-rgb-magenta" />
          {getFolderName(note.folderId)}
        </div>
      )}

      {/* Quick Actions (on hover) */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onNotePin(note.id); }}
          className={`p-2 rounded-lg transition-colors border ${
            note.isPinned 
              ? 'bg-rgb-yellow/20 text-rgb-yellow border-rgb-yellow/30' 
              : 'bg-terminal-hover text-neutral-400 hover:text-white border-terminal-border'
          }`}
        >
          <Pin className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) onNoteDelete(note.id); }}
          className="p-2 rounded-lg bg-terminal-hover text-neutral-400 hover:text-rgb-red transition-colors border border-terminal-border"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 pb-32">
        <div className="w-20 h-20 rounded-xl bg-terminal-surface border border-terminal-border flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-neutral-600" />
        </div>
        <p className="text-lg font-semibold text-neutral-400">No recordings yet</p>
        <p className="text-sm text-neutral-600 mt-1 font-mono">Tap the record button to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      {/* Sync indicator */}
      {isSyncing && (
        <div className="mx-4 mb-4 px-4 py-2 bg-rgb-cyan/10 border border-rgb-cyan/20 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-rgb-cyan rounded-full animate-pulse" />
          <span className="text-sm text-rgb-cyan font-mono font-medium">Syncing...</span>
        </div>
      )}

      {/* Pinned Section */}
      {pinnedNotes.length > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Pin className="w-4 h-4 text-rgb-yellow" />
            <h2 className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-widest">Pinned</h2>
          </div>
          <div className="space-y-3">
            {pinnedNotes.map(note => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Section */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-widest">Recent</h2>
          <span className="text-[10px] font-mono bg-terminal-surface text-neutral-500 px-2 py-0.5 rounded border border-terminal-border">
            {recentNotes.length}
          </span>
        </div>
        <div className="space-y-3">
          {recentNotes.map(note => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomeView;
