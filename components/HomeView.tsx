import React from 'react';
import { motion } from 'framer-motion';
import { Pin, MoreVertical, Clock, FileText, Trash2, FolderOpen, Tag } from 'lucide-react';
import { VoiceNote, Parser, Folder, Tag as TagType } from '../types';
import { formatDistanceToNow } from 'date-fns';

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

  const pinnedNotes = notes.filter(n => n.isPinned);
  const recentNotes = notes.filter(n => !n.isPinned);

  const NoteCard: React.FC<{ note: VoiceNote }> = ({ note }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onClick={() => onNoteSelect(note)}
      className="group relative bg-slate-800/40 hover:bg-slate-800/60 border border-white/5 rounded-2xl p-4 transition-all cursor-pointer"
    >
      {/* Pin indicator */}
      {note.isPinned && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
          <Pin className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Title / Preview */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-slate-100 font-medium text-base leading-snug line-clamp-2">
          {note.title || note.transcript?.substring(0, 60) || (
            <span className="text-slate-500 italic">
              {note.status === 'processing' ? 'Processing...' : 'Untitled Recording'}
            </span>
          )}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Show menu
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {note.tags.slice(0, 3).map(tag => (
            <span
              key={tag.id}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 text-slate-400">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Metadata Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(note.createdAt, { addSuffix: true })}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {formatDuration(note.duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status */}
          {note.status === 'processing' && (
            <span className="flex items-center gap-1 text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
              SYNCING
            </span>
          )}
          {note.status === 'error' && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(note); }}
              className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold hover:bg-red-500/20"
            >
              RETRY
            </button>
          )}
          {note.status === 'pending' && (
            <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
              OFFLINE
            </span>
          )}

          {/* Parser badge */}
          <span className="bg-slate-700/50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider text-slate-300">
            {getParserName(note.parserId)}
          </span>
        </div>
      </div>

      {/* Folder indicator */}
      {note.folderId && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2 text-xs text-slate-500">
          <FolderOpen className="w-3 h-3" />
          {getFolderName(note.folderId)}
        </div>
      )}

      {/* Quick Actions (on hover) */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onNotePin(note.id); }}
          className={`p-2 rounded-lg transition-colors ${
            note.isPinned 
              ? 'bg-amber-500/20 text-amber-400' 
              : 'bg-slate-700/50 text-slate-400 hover:text-white'
          }`}
        >
          <Pin className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) onNoteDelete(note.id); }}
          className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 pb-32">
        <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-400">No recordings yet</p>
        <p className="text-sm text-slate-500 mt-1">Tap the record button to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      {/* Sync indicator */}
      {isSyncing && (
        <div className="mx-4 mb-4 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2">
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
          <span className="text-sm text-indigo-400 font-medium">Syncing...</span>
        </div>
      )}

      {/* Pinned Section */}
      {pinnedNotes.length > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Pin className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pinned</h2>
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
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recent</h2>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
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
