import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder as FolderIcon, Plus, MoreVertical, FileText, ChevronRight, Edit3, Trash2, X } from 'lucide-react';
import { Folder, VoiceNote } from '../types';
import { folderColors } from '../theme';

interface FoldersViewProps {
  folders: Folder[];
  notes: VoiceNote[];
  onFolderSelect: (folder: Folder) => void;
  onFolderCreate: (name: string, color: string) => void;
  onFolderUpdate: (id: string, name: string, color: string) => void;
  onFolderDelete: (id: string) => void;
}

const FoldersView: React.FC<FoldersViewProps> = ({
  folders,
  notes,
  onFolderSelect,
  onFolderCreate,
  onFolderUpdate,
  onFolderDelete,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(folderColors[0]);

  const getFolderNoteCount = (folderId: string) => 
    notes.filter(n => n.folderId === folderId).length;

  const uncategorizedCount = notes.filter(n => !n.folderId).length;

  const handleCreate = () => {
    if (!newFolderName.trim()) return;
    onFolderCreate(newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setNewFolderColor(folderColors[0]);
    setShowCreateModal(false);
  };

  const handleUpdate = () => {
    if (!editingFolder || !newFolderName.trim()) return;
    onFolderUpdate(editingFolder.id, newFolderName.trim(), newFolderColor);
    setEditingFolder(null);
    setNewFolderName('');
    setNewFolderColor(folderColors[0]);
  };

  const openEditModal = (folder: Folder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setNewFolderColor(folder.color);
  };

  const FolderCard: React.FC<{ folder: Folder }> = ({ folder }) => {
    const noteCount = getFolderNoteCount(folder.id);
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="group relative bg-slate-800/40 hover:bg-slate-800/60 border border-white/5 rounded-2xl p-4 transition-all cursor-pointer"
        onClick={() => onFolderSelect(folder)}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${folder.color}20` }}
          >
            <FolderIcon className="w-6 h-6" style={{ color: folder.color }} />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(folder);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-slate-100 font-semibold text-base mb-1">{folder.name}</h3>
        <div className="flex items-center gap-1 text-slate-500 text-sm">
          <FileText className="w-3.5 h-3.5" />
          <span>{noteCount} {noteCount === 1 ? 'note' : 'notes'}</span>
        </div>

        <ChevronRight className="absolute bottom-4 right-4 w-5 h-5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      {/* Header */}
      <div className="px-4 pt-2 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Folders</h1>
          <p className="text-sm text-slate-500 mt-1">Organize your notes</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Uncategorized */}
      {uncategorizedCount > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="text-slate-200 font-medium">Uncategorized</h3>
                <span className="text-xs text-slate-500">{uncategorizedCount} notes</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      )}

      {/* Folders Grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {folders.map(folder => (
          <FolderCard key={folder.id} folder={folder} />
        ))}

        {/* Add Folder Card */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateModal(true)}
          className="bg-slate-800/20 border-2 border-dashed border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[140px] hover:border-indigo-500/50 hover:bg-slate-800/30 transition-all"
        >
          <Plus className="w-8 h-8 text-slate-600 mb-2" />
          <span className="text-sm text-slate-500">New Folder</span>
        </motion.button>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || editingFolder) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => { setShowCreateModal(false); setEditingFolder(null); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-slate-800 rounded-t-3xl p-6 safe-bottom"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingFolder ? 'Edit Folder' : 'New Folder'}
                </h2>
                <button
                  onClick={() => { setShowCreateModal(false); setEditingFolder(null); }}
                  className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Name Input */}
              <div className="mb-6">
                <label className="text-sm font-medium text-slate-400 mb-2 block">Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              {/* Color Picker */}
              <div className="mb-8">
                <label className="text-sm font-medium text-slate-400 mb-3 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {folderColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewFolderColor(color)}
                      className={`w-10 h-10 rounded-xl transition-all ${
                        newFolderColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {editingFolder && (
                  <button
                    onClick={() => {
                      if (confirm('Delete this folder? Notes will be moved to Uncategorized.')) {
                        onFolderDelete(editingFolder.id);
                        setEditingFolder(null);
                      }
                    }}
                    className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={editingFolder ? handleUpdate : handleCreate}
                  disabled={!newFolderName.trim()}
                  className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-400 transition-colors"
                >
                  {editingFolder ? 'Save' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FoldersView;
