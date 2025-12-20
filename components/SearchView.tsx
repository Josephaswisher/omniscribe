import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Filter, Calendar, Tag, Folder, Clock, FileText, Mic } from 'lucide-react';
import { VoiceNote, Parser, Folder as FolderType, Tag as TagType, SearchFilters } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface SearchViewProps {
  notes: VoiceNote[];
  parsers: Parser[];
  folders: FolderType[];
  tags: TagType[];
  onNoteSelect: (note: VoiceNote) => void;
}

const SearchView: React.FC<SearchViewProps> = ({
  notes,
  parsers,
  folders,
  tags,
  onNoteSelect,
}) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ query: '' });

  // Levenshtein distance for fuzzy matching
  const getLevenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }
    return matrix[b.length][a.length];
  };

  const fuzzyMatch = (text: string, searchQuery: string): boolean => {
    if (!text) return false;
    const normalizedText = text.toLowerCase();
    const normalizedQuery = searchQuery.toLowerCase();
    if (normalizedText.includes(normalizedQuery)) return true;
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    const textWords = normalizedText.split(/[^\w]+/).filter(w => w.length > 0);
    return queryWords.every(qWord => {
      if (textWords.includes(qWord)) return true;
      return textWords.some(tWord => {
        if (Math.abs(qWord.length - tWord.length) > 2) return false;
        const threshold = qWord.length > 4 ? 2 : 1;
        return getLevenshteinDistance(qWord, tWord) <= threshold;
      });
    });
  };

  const filteredNotes = useMemo(() => {
    if (!query && !filters.folderId && !filters.tags?.length && !filters.parserId) {
      return [];
    }

    return notes.filter(note => {
      // Text search
      if (query) {
        const matchesTranscript = note.transcript && fuzzyMatch(note.transcript, query);
        const matchesSummary = note.parsedSummary && fuzzyMatch(note.parsedSummary, query);
        const matchesTitle = note.title && fuzzyMatch(note.title, query);
        if (!matchesTranscript && !matchesSummary && !matchesTitle) return false;
      }

      // Folder filter
      if (filters.folderId && note.folderId !== filters.folderId) return false;

      // Parser filter
      if (filters.parserId && note.parserId !== filters.parserId) return false;

      // Tag filter
      if (filters.tags?.length) {
        const noteTags = note.tags?.map(t => t.id) || [];
        if (!filters.tags.some(t => noteTags.includes(t))) return false;
      }

      // Status filter
      if (filters.status && note.status !== filters.status) return false;

      return true;
    });
  }, [notes, query, filters]);

  const getParserName = (id: string) => parsers.find(p => p.id === id)?.name || 'Raw';

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const recentSearches = ['meeting notes', 'todo', 'ideas'];

  return (
    <div className="flex-1 flex flex-col pb-32">
      {/* Search Header */}
      <div className="px-4 pt-2 pb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts, summaries..."
            className="w-full pl-12 pr-20 py-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-base"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4">
                {/* Folder Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">Folder</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setFilters(f => ({ ...f, folderId: undefined }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        !filters.folderId ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      All
                    </button>
                    {folders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => setFilters(f => ({ ...f, folderId: folder.id }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                          filters.folderId === folder.id ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color }} />
                        {folder.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parser Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">Parser</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setFilters(f => ({ ...f, parserId: undefined }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        !filters.parserId ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      All
                    </button>
                    {parsers.map(parser => (
                      <button
                        key={parser.id}
                        onClick={() => setFilters(f => ({ ...f, parserId: parser.id }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          filters.parserId === parser.id ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {parser.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags Filter */}
                {tags.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-2 block">Tags</label>
                    <div className="flex gap-2 flex-wrap">
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            const currentTags = filters.tags || [];
                            const newTags = currentTags.includes(tag.id)
                              ? currentTags.filter(t => t !== tag.id)
                              : [...currentTags, tag.id];
                            setFilters(f => ({ ...f, tags: newTags.length ? newTags : undefined }));
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            filters.tags?.includes(tag.id) ? 'ring-2 ring-white' : ''
                          }`}
                          style={{ 
                            backgroundColor: `${tag.color}20`, 
                            color: tag.color 
                          }}
                        >
                          #{tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear Filters */}
                {(filters.folderId || filters.parserId || filters.tags?.length) && (
                  <button
                    onClick={() => setFilters({ query: '' })}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results / Empty State */}
      <div className="flex-1 overflow-y-auto px-4">
        {!query && filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-slate-600" />
            </div>
            <p className="text-lg font-medium text-slate-400 mb-2">Search your notes</p>
            <p className="text-sm text-slate-500 mb-6">Find transcripts, summaries, and more</p>
            
            {recentSearches.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Recent searches</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {recentSearches.map(term => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="px-3 py-1.5 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-base text-slate-400">No results found</p>
            <p className="text-sm text-slate-500 mt-1">Try different keywords or filters</p>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            <p className="text-xs text-slate-500 mb-3">
              {filteredNotes.length} result{filteredNotes.length !== 1 ? 's' : ''}
            </p>
            {filteredNotes.map(note => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onNoteSelect(note)}
                className="bg-slate-800/40 hover:bg-slate-800/60 border border-white/5 rounded-xl p-4 cursor-pointer transition-all"
              >
                <h3 className="text-slate-100 font-medium mb-2 line-clamp-1">
                  {note.title || note.transcript?.substring(0, 50) || 'Untitled'}
                </h3>
                {note.transcript && (
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                    {note.transcript}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mic className="w-3 h-3" />
                      {formatDuration(note.duration)}
                    </span>
                  </div>
                  <span className="bg-slate-700/50 px-2 py-0.5 rounded text-[10px] uppercase">
                    {getParserName(note.parserId)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchView;
