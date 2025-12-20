
import React, { useEffect, useState } from 'react';
import { VoiceNote, Parser } from '../types';

interface NoteDetailProps {
  note: VoiceNote;
  parser: Parser | undefined;
  onBack: () => void;
}

const NoteDetail: React.FC<NoteDetailProps> = ({ note, parser, onBack }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (note.audioBlob) {
      const url = URL.createObjectURL(note.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [note.audioBlob]);

  if (!audioUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 animate-[slideUp_0.3s_ease-out]">
        <style>{`
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
        `}</style>
      
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-4 safe-top glass border-b-0">
        <div className="flex items-center justify-between">
            <button 
                onClick={onBack} 
                className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-300 hover:bg-slate-700 active:scale-95 transition-all backdrop-blur-md"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <div className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                {parser?.name || 'Note'}
            </div>
            <div className="w-10" /> {/* Spacer */}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto safe-bottom pt-24 pb-12 px-6 space-y-8 bg-gradient-to-b from-slate-900 to-slate-950">
        
        {/* Audio Player Card */}
        <div className="bg-slate-800/40 border border-white/5 p-6 rounded-2xl shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recording</span>
                <span className="text-xs font-mono text-slate-400">
                    {new Date(note.createdAt).toLocaleDateString()}
                </span>
            </div>
            <audio src={audioUrl} controls className="w-full h-10 rounded-lg opacity-90 invert brightness-0 contrast-200 sepia saturate-0 hue-rotate-180" />
        </div>

        {/* AI Summary Card */}
        {note.parsedSummary && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="p-1 bg-indigo-500 rounded-lg">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-200">AI Insight</h3>
            </div>
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-5 text-slate-200 leading-relaxed shadow-sm">
              {note.parsedSummary}
            </div>
          </div>
        )}

        {/* Transcript Section */}
        <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">Transcript</h3>
            <div className="text-slate-300 leading-7 font-light text-lg">
                {note.status === 'processing' ? (
                    <div className="flex items-center gap-3 text-slate-500">
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200" />
                    </div>
                ) : (
                    note.transcript || <span className="text-slate-600 italic">No speech detected.</span>
                )}
            </div>
        </div>
      </main>
    </div>
  );
};

export default NoteDetail;
