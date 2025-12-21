import React from "react";
import { VoiceNote, Parser } from "../types";
import LanguageBadge from "./LanguageBadge";

interface NotesListProps {
  notes: VoiceNote[];
  parsers: Parser[];
  onNoteSelect: (note: VoiceNote) => void;
  onDelete: (id: string) => void;
  onRetry: (note: VoiceNote) => void;
  isSearching?: boolean;
}

const NotesList: React.FC<NotesListProps> = ({
  notes,
  parsers,
  onNoteSelect,
  onDelete,
  onRetry,
  isSearching,
}) => {
  const getParserName = (id: string) =>
    parsers.find((p) => p.id === id)?.name || "Raw";

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  if (notes.length === 0) {
    if (isSearching) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500/50 pb-20 pt-10">
          <svg
            className="w-12 h-12 mb-4 stroke-1 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-base font-medium text-slate-400">
            No matches found
          </p>
          <p className="text-xs">Try searching for a different keyword</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500/50 pb-20">
        <svg
          className="w-16 h-16 mb-6 stroke-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
          />
        </svg>
        <p className="text-lg font-medium text-slate-400">No recordings yet</p>
        <p className="text-sm">Tap the button to start</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-32 space-y-3">
      <div className="flex items-center justify-between px-2 pt-4 pb-2">
        <h3 className="text-xs font-bold text-slate-500/80 uppercase tracking-widest">
          {isSearching ? "Search Results" : "Recent Notes"}
        </h3>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
          {notes.length}
        </span>
      </div>

      {notes.map((note) => (
        <div
          key={note.id}
          onClick={() => onNoteSelect(note)}
          className="group relative bg-slate-800/40 hover:bg-slate-800/60 active:scale-[0.99] backdrop-blur-sm border border-white/5 rounded-xl p-4 transition-all duration-200"
        >
          {/* Top Row: Date & Status */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col">
              <span className="text-slate-100 font-semibold text-base leading-tight">
                {note.transcript ? (
                  note.transcript.length > 60 ? (
                    note.transcript.substring(0, 60) + "..."
                  ) : (
                    note.transcript
                  )
                ) : (
                  <span className="text-slate-500 italic">
                    {note.status === "processing"
                      ? "Processing audio..."
                      : "Untitled Recording"}
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete?")) onDelete(note.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 -mr-2 -mt-2 text-slate-500 hover:text-red-400 transition-opacity"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Bottom Row: Metadata */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <span className="bg-slate-700/50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider text-slate-300">
                  {getParserName(note.parserId)}
                </span>
                <span>{formatTime(note.createdAt)}</span>
                {note.languageCode && (
                  <LanguageBadge
                    languageCode={note.languageCode}
                    detectedLanguage={note.detectedLanguage}
                    size="sm"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status Badges */}
              {note.status === "processing" && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                  SYNCING
                </span>
              )}
              {note.status === "error" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(note);
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full hover:bg-red-500/20"
                >
                  FAILED ↻
                </button>
              )}
              {note.status === "pending" && (
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  OFFLINE
                </span>
              )}

              <span className="text-xs font-mono text-slate-500">
                {formatDuration(note.duration)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotesList;
