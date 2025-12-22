import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, Clock, RotateCcw, Eye, X, ChevronRight, 
  FileText, Sparkles, PenTool, Type
} from 'lucide-react';
import { NoteVersion, VoiceNote } from '../types';
import { formatDistanceToNow, format } from 'date-fns';

interface NoteVersionHistoryProps {
  note: VoiceNote;
  onRestore: (version: NoteVersion) => void;
  onClose: () => void;
}

const NoteVersionHistory: React.FC<NoteVersionHistoryProps> = ({
  note,
  onRestore,
  onClose,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const versions = note.versions || [];

  const getChangeIcon = (type: NoteVersion['changeType']) => {
    switch (type) {
      case 'transcript': return <FileText className="w-4 h-4" />;
      case 'summary': return <Sparkles className="w-4 h-4" />;
      case 'template': return <PenTool className="w-4 h-4" />;
      case 'title': return <Type className="w-4 h-4" />;
      default: return <History className="w-4 h-4" />;
    }
  };

  const getChangeColor = (type: NoteVersion['changeType']) => {
    switch (type) {
      case 'transcript': return 'text-blue-400 bg-blue-500/10';
      case 'summary': return 'text-purple-400 bg-purple-500/10';
      case 'template': return 'text-indigo-400 bg-indigo-500/10';
      case 'title': return 'text-amber-400 bg-amber-500/10';
      default: return 'text-neutral-400 bg-neutral-500/10';
    }
  };

  const handleRestore = (version: NoteVersion) => {
    if (confirm(`Restore this version from ${format(version.createdAt, 'MMM d, h:mm a')}? Current content will be saved as a new version.`)) {
      onRestore(version);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-terminal-surface rounded-t-3xl overflow-hidden max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Version History</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-terminal-hover flex items-center justify-center"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-4 safe-bottom">
          {versions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <p className="text-neutral-400">No version history yet</p>
              <p className="text-sm text-neutral-500 mt-1">
                Versions are saved automatically when you make changes
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Current Version */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-400">Current Version</p>
                      <p className="text-xs text-neutral-500">Now</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-green-400 bg-green-500/20 px-2 py-1 rounded">
                    Active
                  </span>
                </div>
              </div>

              {/* Previous Versions */}
              {versions.slice().reverse().map((version, index) => (
                <motion.div
                  key={version.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-terminal-hover rounded-xl p-4 hover:bg-terminal-surface transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getChangeColor(version.changeType)}`}>
                        {getChangeIcon(version.changeType)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-100">
                          {version.changeDescription || `${version.changeType} change`}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {formatDistanceToNow(version.createdAt, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowPreview(true);
                        }}
                        className="p-2 rounded-lg bg-terminal-surface text-neutral-400 hover:text-white transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRestore(version)}
                        className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                        title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        <AnimatePresence>
          {showPreview && selectedVersion && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-terminal-bg z-10 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-terminal-border">
                <div>
                  <h3 className="text-lg font-bold text-white">Version Preview</h3>
                  <p className="text-xs text-neutral-500">
                    {format(selectedVersion.createdAt, 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="w-8 h-8 rounded-full bg-terminal-hover flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedVersion.title && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-500 uppercase mb-2">Title</h4>
                    <p className="text-neutral-100">{selectedVersion.title}</p>
                  </div>
                )}
                {selectedVersion.transcript && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-500 uppercase mb-2">Transcript</h4>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap">
                      {selectedVersion.transcript}
                    </p>
                  </div>
                )}
                {selectedVersion.parsedSummary && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-500 uppercase mb-2">Summary</h4>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap">
                      {selectedVersion.parsedSummary}
                    </p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-terminal-border">
                <button
                  onClick={() => handleRestore(selectedVersion)}
                  className="w-full py-3 bg-rgb-cyan text-white rounded-xl font-medium hover:bg-indigo-400 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore This Version
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default NoteVersionHistory;

// Helper function to create a version snapshot
export const createVersionSnapshot = (
  note: VoiceNote,
  changeType: NoteVersion['changeType'],
  changeDescription?: string
): NoteVersion => {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    transcript: note.transcript,
    parsedSummary: note.parsedSummary,
    templateOutputs: note.templateOutputs ? [...note.templateOutputs] : undefined,
    title: note.title,
    changeType,
    changeDescription,
  };
};
