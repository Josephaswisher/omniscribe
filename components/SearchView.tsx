import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Filter,
  Calendar,
  Tag,
  Folder,
  Clock,
  FileText,
  Mic,
  PenTool,
  Sparkles,
} from "lucide-react";
import {
  VoiceNote,
  Parser,
  Folder as FolderType,
  Tag as TagType,
  SearchFilters,
  Template,
} from "../types";
import { formatDistanceToNow } from "date-fns";

interface SearchMatch {
  type: "title" | "transcript" | "summary" | "template";
  templateName?: string;
  snippet: string;
}

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
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ query: "" });

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
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
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
    const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);
    const textWords = normalizedText
      .split(/[^\w]+/)
      .filter((w) => w.length > 0);
    return queryWords.every((qWord) => {
      if (textWords.includes(qWord)) return true;
      return textWords.some((tWord) => {
        if (Math.abs(qWord.length - tWord.length) > 2) return false;
        const threshold = qWord.length > 4 ? 2 : 1;
        return getLevenshteinDistance(qWord, tWord) <= threshold;
      });
    });
  };

  const getSnippet = (
    text: string,
    searchQuery: string,
    maxLength: number = 120,
  ): string => {
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1)
      return (
        text.substring(0, maxLength) + (text.length > maxLength ? "..." : "")
      );
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + searchQuery.length + 60);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < text.length) snippet = snippet + "...";
    return snippet;
  };

  const filteredNotesWithMatches = useMemo(() => {
    if (
      !query &&
      !filters.folderId &&
      !filters.tags?.length &&
      !filters.parserId
    ) {
      return [];
    }

    return notes
      .map((note) => {
        const matches: SearchMatch[] = [];

        // Text search - check all content types
        if (query) {
          if (note.title && fuzzyMatch(note.title, query)) {
            matches.push({ type: "title", snippet: note.title });
          }
          if (note.transcript && fuzzyMatch(note.transcript, query)) {
            matches.push({
              type: "transcript",
              snippet: getSnippet(note.transcript, query),
            });
          }
          if (note.parsedSummary && fuzzyMatch(note.parsedSummary, query)) {
            matches.push({
              type: "summary",
              snippet: getSnippet(note.parsedSummary, query),
            });
          }
          // Search in template outputs
          if (note.templateOutputs) {
            note.templateOutputs.forEach((output) => {
              if (fuzzyMatch(output.output, query)) {
                matches.push({
                  type: "template",
                  templateName: output.templateName,
                  snippet: getSnippet(output.output, query),
                });
              }
            });
          }
        }

        // If query exists but no matches, skip this note
        if (query && matches.length === 0) return null;

        // Folder filter
        if (filters.folderId && note.folderId !== filters.folderId) return null;

        // Parser filter
        if (filters.parserId && note.parserId !== filters.parserId) return null;

        // Tag filter
        if (filters.tags?.length) {
          const noteTags = note.tags?.map((t) => t.id) || [];
          if (!filters.tags.some((t) => noteTags.includes(t))) return null;
        }

        // Status filter
        if (filters.status && note.status !== filters.status) return null;

        return { note, matches };
      })
      .filter(Boolean) as { note: VoiceNote; matches: SearchMatch[] }[];
  }, [notes, query, filters]);

  const filteredNotes = filteredNotesWithMatches.map((r) => r.note);

  const getParserName = (id: string) =>
    parsers.find((p) => p.id === id)?.name || "Raw";

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const recentSearches = ["meeting notes", "todo", "ideas"];

  return (
    <div className="flex-1 flex flex-col pb-32">
      {/* Search Header */}
      <div className="px-4 pt-2 pb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts, summaries..."
            className="w-full pl-12 pr-20 py-4 bg-terminal-hover border border-terminal-border rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-base"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters
                  ? "bg-rgb-cyan text-white"
                  : "bg-terminal-hover text-neutral-400"
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
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4">
                {/* Folder Filter */}
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-2 block">
                    Folder
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() =>
                        setFilters((f) => ({ ...f, folderId: undefined }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        !filters.folderId
                          ? "bg-rgb-cyan text-white"
                          : "bg-terminal-hover text-neutral-200"
                      }`}
                    >
                      All
                    </button>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() =>
                          setFilters((f) => ({ ...f, folderId: folder.id }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                          filters.folderId === folder.id
                            ? "bg-rgb-cyan text-white"
                            : "bg-terminal-hover text-neutral-200"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: folder.color }}
                        />
                        {folder.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parser Filter */}
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-2 block">
                    Parser
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() =>
                        setFilters((f) => ({ ...f, parserId: undefined }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        !filters.parserId
                          ? "bg-rgb-cyan text-white"
                          : "bg-terminal-hover text-neutral-200"
                      }`}
                    >
                      All
                    </button>
                    {parsers.map((parser) => (
                      <button
                        key={parser.id}
                        onClick={() =>
                          setFilters((f) => ({ ...f, parserId: parser.id }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          filters.parserId === parser.id
                            ? "bg-rgb-cyan text-white"
                            : "bg-terminal-hover text-neutral-200"
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
                    <label className="text-xs font-medium text-neutral-500 mb-2 block">
                      Tags
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            const currentTags = filters.tags || [];
                            const newTags = currentTags.includes(tag.id)
                              ? currentTags.filter((t) => t !== tag.id)
                              : [...currentTags, tag.id];
                            setFilters((f) => ({
                              ...f,
                              tags: newTags.length ? newTags : undefined,
                            }));
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            filters.tags?.includes(tag.id)
                              ? "ring-2 ring-white"
                              : ""
                          }`}
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          #{tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear Filters */}
                {(filters.folderId ||
                  filters.parserId ||
                  filters.tags?.length) && (
                  <button
                    onClick={() => setFilters({ query: "" })}
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
            <div className="w-20 h-20 rounded-full bg-terminal-surface flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-neutral-600" />
            </div>
            <p className="text-lg font-medium text-neutral-400 mb-2">
              Search your notes
            </p>
            <p className="text-sm text-neutral-500 mb-6">
              Find transcripts, summaries, and more
            </p>

            {recentSearches.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">Recent searches</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="px-3 py-1.5 bg-terminal-surface rounded-lg text-sm text-neutral-200 hover:bg-terminal-hover"
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
            <div className="w-16 h-16 rounded-full bg-terminal-surface flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-neutral-600" />
            </div>
            <p className="text-base text-neutral-400">No results found</p>
            <p className="text-sm text-neutral-500 mt-1">
              Try different keywords or filters
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            <p className="text-xs text-neutral-500 mb-3">
              {filteredNotes.length} result
              {filteredNotes.length !== 1 ? "s" : ""}
            </p>
            {filteredNotesWithMatches.map(({ note, matches }) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onNoteSelect(note)}
                className="bg-terminal-surface hover:bg-terminal-hover border border-white/5 rounded-xl p-4 cursor-pointer transition-all"
              >
                <h3 className="text-slate-100 font-medium mb-2 line-clamp-1">
                  {note.title ||
                    note.transcript?.substring(0, 50) ||
                    "Untitled"}
                </h3>

                {/* Show matched content with source badges */}
                {query && matches.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {matches.slice(0, 2).map((match, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span
                          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase flex items-center gap-1 ${
                            match.type === "transcript"
                              ? "bg-neutral-700 text-neutral-300"
                              : match.type === "summary"
                                ? "bg-purple-500/20 text-purple-400"
                                : match.type === "template"
                                  ? "bg-indigo-500/20 text-indigo-400"
                                  : "bg-neutral-700 text-neutral-300"
                          }`}
                        >
                          {match.type === "transcript" && (
                            <FileText className="w-2.5 h-2.5" />
                          )}
                          {match.type === "summary" && (
                            <Sparkles className="w-2.5 h-2.5" />
                          )}
                          {match.type === "template" && (
                            <PenTool className="w-2.5 h-2.5" />
                          )}
                          {match.type === "template"
                            ? match.templateName
                            : match.type}
                        </span>
                        <p className="text-sm text-neutral-400 line-clamp-1 flex-1">
                          {match.snippet}
                        </p>
                      </div>
                    ))}
                    {matches.length > 2 && (
                      <p className="text-xs text-neutral-500 pl-1">
                        +{matches.length - 2} more match
                        {matches.length - 2 !== 1 ? "es" : ""}
                      </p>
                    )}
                  </div>
                )}

                {/* Fallback to transcript if no query matches shown */}
                {(!query || matches.length === 0) && note.transcript && (
                  <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
                    {note.transcript}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-neutral-500">
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
                  <div className="flex items-center gap-2">
                    {note.templateOutputs &&
                      note.templateOutputs.length > 0 && (
                        <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded text-[10px]">
                          {note.templateOutputs.length} template
                          {note.templateOutputs.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    <span className="bg-terminal-hover px-2 py-0.5 rounded text-[10px] uppercase">
                      {getParserName(note.parserId)}
                    </span>
                  </div>
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
