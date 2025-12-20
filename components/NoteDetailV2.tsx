import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Share2, MoreVertical, Play, Pause, 
  Bookmark, BookmarkPlus, Tag, FolderOpen, Trash2,
  Copy, Download, Clock, Sparkles, Edit3, Check, X
} from 'lucide-react';
import { VoiceNote, Parser, Folder, Tag as TagType, Bookmark as BookmarkType } from '../types';
import Waveform from './Waveform';
import { format } from 'date-fns';

interface NoteDetailV2Props {
  note: VoiceNote;
  parser: Parser | undefined;
  folders: Folder[];
  tags: TagType[];
  onBack: () => void;
  onUpdate: (updates: Partial<VoiceNote>) => void;
  onDelete: () => void;
  onAddBookmark: (timestamp: number, label?: string) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onMoveToFolder: (folderId: string | null) => void;
}

const NoteDetailV2: React.FC<NoteDetailV2Props> = ({
  note,
  parser,
  folders,
  tags,
  onBack,
  onUpdate,
  onDelete,
  onAddBookmark,
  onDeleteBookmark,
  onAddTag,
  onRemoveTag,
  onMoveToFolder,
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData] = useState<number[]>(() => 
    Array.from({ length: 50 }, () => 0.2 + Math.random() * 0.6)
  );
  const [showMenu, setShowMenu] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.title || '');
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (note.audioBlob) {
      const url = URL.createObjectURL(note.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [note.audioBlob]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = async () => {
    const shareData = {
      title: note.title || 'Voice Note',
      text: note.transcript || '',
    };
    try {
      await navigator.share(shareData);
    } catch (err) {
      // Copy to clipboard as fallback
      await navigator.clipboard.writeText(note.transcript || '');
      alert('Copied to clipboard!');
    }
  };

  const handleCopy = async () => {
    const content = `${note.title || 'Voice Note'}\n\n${note.transcript || ''}\n\n${note.parsedSummary || ''}`;
    await navigator.clipboard.writeText(content);
    alert('Copied to clipboard!');
  };

  const saveTitle = () => {
    onUpdate({ title: titleDraft });
    setIsEditingTitle(false);
  };

  if (!audioUrl) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-900"
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} />

      {/* Header */}
      <header className="safe-top px-4 py-4 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center"
            >
              <Share2 className="w-5 h-5 text-slate-300" />
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center"
            >
              <MoreVertical className="w-5 h-5 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Menu Dropdown */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-4 top-20 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-10"
            >
              <button
                onClick={() => { setShowFolderPicker(true); setShowMenu(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 text-left"
              >
                <FolderOpen className="w-4 h-4 text-slate-400" />
                <span className="text-slate-200">Move to folder</span>
              </button>
              <button
                onClick={() => { setShowTagPicker(true); setShowMenu(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 text-left"
              >
                <Tag className="w-4 h-4 text-slate-400" />
                <span className="text-slate-200">Add tags</span>
              </button>
              <button
                onClick={handleCopy}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 text-left"
              >
                <Copy className="w-4 h-4 text-slate-400" />
                <span className="text-slate-200">Copy text</span>
              </button>
              <button
                onClick={() => { if (confirm('Delete this note?')) onDelete(); }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 text-left text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete note</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 overflow-y-auto safe-bottom">
        {/* Title Section */}
        <div className="px-6 py-4">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="flex-1 text-2xl font-bold bg-transparent text-white border-b border-indigo-500 focus:outline-none"
                autoFocus
              />
              <button onClick={saveTitle} className="p-2 text-green-400">
                <Check className="w-5 h-5" />
              </button>
              <button onClick={() => setIsEditingTitle(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setTitleDraft(note.title || ''); setIsEditingTitle(true); }}
              className="flex items-center gap-2 group"
            >
              <h1 className="text-2xl font-bold text-white">
                {note.title || 'Untitled Note'}
              </h1>
              <Edit3 className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
            <span>{format(note.createdAt, 'MMM d, yyyy • h:mm a')}</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-xs uppercase">
              {parser?.name || 'Raw'}
            </span>
          </div>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {note.tags.map(tag => (
                <span
                  key={tag.id}
                  className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  #{tag.name}
                  <button
                    onClick={() => onRemoveTag(tag.id)}
                    className="hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Audio Player */}
        <div className="mx-6 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={togglePlayback}
              className="w-14 h-14 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-1" />
              )}
            </button>
            <div className="flex-1">
              <Waveform
                data={waveformData}
                isRecording={false}
                isPaused={true}
                progress={currentTime / note.duration}
                height={40}
                barWidth={3}
                barGap={2}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 font-mono">{formatTime(currentTime)}</span>
            <button
              onClick={() => onAddBookmark(currentTime)}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span className="text-xs">Bookmark</span>
            </button>
            <span className="text-slate-400 font-mono">{formatTime(note.duration)}</span>
          </div>

          {/* Bookmarks */}
          {note.bookmarks && note.bookmarks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Bookmarks</h4>
              <div className="space-y-2">
                {note.bookmarks.map(bookmark => (
                  <button
                    key={bookmark.id}
                    onClick={() => seekTo(bookmark.timestampSeconds)}
                    className="w-full flex items-center justify-between py-2 px-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50"
                  >
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-3 h-3 text-amber-400" />
                      <span className="text-sm text-slate-300">
                        {bookmark.label || `Bookmark at ${formatTime(bookmark.timestampSeconds)}`}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {formatTime(bookmark.timestampSeconds)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Summary */}
        {note.parsedSummary && (
          <div className="mx-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-300">AI Summary</h3>
            </div>
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-xl p-4">
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                {note.parsedSummary}
              </p>
            </div>
          </div>
        )}

        {/* Transcript */}
        <div className="mx-6 mb-8">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Transcript
          </h3>
          <div className="text-slate-300 leading-7">
            {note.status === 'processing' ? (
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <span>Processing...</span>
              </div>
            ) : (
              note.transcript || <span className="text-slate-600 italic">No speech detected.</span>
            )}
          </div>
        </div>
      </main>

      {/* Tag Picker Modal */}
      <AnimatePresence>
        {showTagPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/60 flex items-end"
            onClick={() => setShowTagPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-slate-800 rounded-t-3xl p-6 safe-bottom"
            >
              <h3 className="text-lg font-bold text-white mb-4">Add Tags</h3>
              <div className="flex gap-2 flex-wrap">
                {tags.map(tag => {
                  const isSelected = note.tags?.some(t => t.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => isSelected ? onRemoveTag(tag.id) : onAddTag(tag.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        isSelected ? 'ring-2 ring-white' : ''
                      }`}
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      #{tag.name}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder Picker Modal */}
      <AnimatePresence>
        {showFolderPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/60 flex items-end"
            onClick={() => setShowFolderPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-slate-800 rounded-t-3xl p-6 safe-bottom"
            >
              <h3 className="text-lg font-bold text-white mb-4">Move to Folder</h3>
              <div className="space-y-2">
                <button
                  onClick={() => { onMoveToFolder(null); setShowFolderPicker(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    !note.folderId ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>Uncategorized</span>
                </button>
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => { onMoveToFolder(folder.id); setShowFolderPicker(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      note.folderId === folder.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: folder.color }} />
                    <span>{folder.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NoteDetailV2;
