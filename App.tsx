
import React, { useState, useEffect, useCallback } from 'react';
import { db } from './db';
import { VoiceNote, Parser, AppView } from './types';
import { DEFAULT_PARSERS } from './constants';
import { transcribeAndParse } from './geminiService';
import { isCloudEnabled } from './services/supabase';
import { syncNoteToCloud, loadParsersFromCloud, mergeLocalAndCloud } from './services/sync';
import { syncNoteToGDrive, checkGDriveConnection } from './services/gdrive';
import { registerServiceWorker } from './registerSW';
import Settings from './components/Settings';
import Recorder from './components/Recorder';
import NotesList from './components/NotesList';
import NoteDetail from './components/NoteDetail';

// Utility for Levenshtein distance
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const fuzzyMatch = (text: string, query: string): boolean => {
  if (!text) return false;
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  // Fast path: exact substring match
  if (normalizedText.includes(normalizedQuery)) return true;

  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
  // Split text by non-word characters to isolate words
  const textWords = normalizedText.split(/[^\w]+/).filter(w => w.length > 0);

  // All query words must find a match (exact or fuzzy) in the text
  return queryWords.every(qWord => {
    // Optimization: if the word exists exactly, move to next
    if (textWords.includes(qWord)) return true;

    // Try fuzzy matching against words in text
    return textWords.some(tWord => {
      // Skip comparing if length difference is too large to be a typo
      if (Math.abs(qWord.length - tWord.length) > 2) return false;
      
      // Allow 1 error for short words, 2 for longer words
      const threshold = qWord.length > 4 ? 2 : 1;
      return getLevenshteinDistance(qWord, tWord) <= threshold;
    });
  });
};

const App: React.FC = () => {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [parsers, setParsers] = useState<Parser[]>(DEFAULT_PARSERS);
  const [selectedParserId, setSelectedParserId] = useState<string>(DEFAULT_PARSERS[0].id);
  const [currentView, setCurrentView] = useState<AppView>('main');
  const [activeNote, setActiveNote] = useState<VoiceNote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [gdriveConnected, setGdriveConnected] = useState(false);

  // Initialize DB, SW, and load data
  useEffect(() => {
    const init = async () => {
      // Register service worker
      registerServiceWorker();
      
      await db.init();
      
      // Load parsers from cloud if available
      if (isCloudEnabled()) {
        const cloudParsers = await loadParsersFromCloud();
        if (cloudParsers.length > 0) {
          setParsers(cloudParsers);
        }
        
        // Check GDrive status
        const gdriveStatus = await checkGDriveConnection();
        setGdriveConnected(gdriveStatus);
        
        // Merge local and cloud notes
        const mergedNotes = await mergeLocalAndCloud();
        setNotes(mergedNotes);
      } else {
        const savedNotes = await db.getAllNotes();
        setNotes(savedNotes);
      }
    };
    init();
  }, []);

  // Search Filtering with Fuzzy Logic
  const filteredNotes = notes.filter(note => {
    if (!searchQuery) return true;
    
    // Check transcript
    if (note.transcript && fuzzyMatch(note.transcript, searchQuery)) return true;
    
    // Check summary
    if (note.parsedSummary && fuzzyMatch(note.parsedSummary, searchQuery)) return true;
    
    return false;
  });

  const processNote = useCallback(async (note: VoiceNote) => {
    // Optimistic update to UI and DB to prevent double processing
    const processingNote: VoiceNote = { ...note, status: 'processing' };
    setNotes(prev => prev.map(n => n.id === note.id ? processingNote : n));
    await db.saveNote(processingNote);

    try {
      let updatedNote: VoiceNote;

      // Use cloud API if available, otherwise use client-side Gemini
      if (isCloudEnabled()) {
        setIsSyncing(true);
        const result = await syncNoteToCloud(processingNote);
        setIsSyncing(false);
        
        if (result.success && result.note) {
          updatedNote = result.note;
          
          // Sync to Google Drive if connected
          if (gdriveConnected) {
            syncNoteToGDrive(updatedNote.id).catch(console.error);
          }
        } else {
          throw new Error(result.error || 'Cloud sync failed');
        }
      } else {
        // Client-side processing (existing behavior)
        const selectedParser = parsers.find(p => p.id === note.parserId) || DEFAULT_PARSERS[0];
        const result = await transcribeAndParse(note.audioBlob, selectedParser);
        
        updatedNote = {
          ...processingNote,
          transcript: result.transcript,
          parsedSummary: result.summary,
          status: 'completed'
        };
      }

      await db.saveNote(updatedNote);
      setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
    } catch (err) {
      console.error("Transcription failed", err);
      const errorNote: VoiceNote = { 
        ...processingNote, 
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Processing failed'
      };
      await db.saveNote(errorNote);
      setNotes(prev => prev.map(n => n.id === errorNote.id ? errorNote : n));
      setIsSyncing(false);
    }
  }, [parsers, gdriveConnected]);

  // Background Sync Logic
  useEffect(() => {
    const syncPending = async () => {
        if (!navigator.onLine) return;
        
        try {
            // Fetch directly from DB to ensure we catch notes not currently in view state or persisted as pending
            const dbNotes = await db.getAllNotes();
            const pendingNotes = dbNotes.filter(n => n.status === 'pending');
            
            if (pendingNotes.length > 0) {
                console.log(`[Sync] Found ${pendingNotes.length} pending notes. Syncing...`);
                // Process sequentially to avoid overwhelming the network/browser
                for (const note of pendingNotes) {
                    await processNote(note);
                }
            }
        } catch (e) {
            console.error("[Sync] Error during sync:", e);
        }
    };

    const handleOnline = () => {
        console.log("[Sync] Online detected.");
        syncPending();
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
             console.log("[Sync] App foregrounded.");
             syncPending();
        }
    };

    // Attach listeners
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Periodic check (every 30 seconds)
    const intervalId = setInterval(syncPending, 30000);

    // Initial check on mount
    syncPending();

    return () => {
        window.removeEventListener('online', handleOnline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(intervalId);
    };
  }, [processNote]); // Re-run effect setup if processNote changes

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    const isOffline = !navigator.onLine;
    const newNote: VoiceNote = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      duration,
      audioBlob: blob,
      parserId: selectedParserId,
      status: isOffline ? 'pending' : 'processing',
    };

    setNotes(prev => [newNote, ...prev]);
    await db.saveNote(newNote);

    if (isOffline) return;

    processNote(newNote);
  };

  const retryProcessing = (note: VoiceNote) => {
    if (!navigator.onLine) {
      alert("You are offline. Please connect to the internet to retry.");
      return;
    }
    processNote(note);
  };

  const deleteNote = async (id: string) => {
    await db.deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeNote?.id === id) {
        setCurrentView('main');
        setActiveNote(null);
    }
  };

  const openNote = (note: VoiceNote) => {
    setActiveNote(note);
    setCurrentView('detail');
  };

  const openSettings = () => {
    setCurrentView('settings');
  };

  const handleAddParser = (parser: Parser) => {
    setParsers(prev => [...prev, parser]);
  };

  const handleDeleteParser = (id: string) => {
    setParsers(prev => prev.filter(p => p.id !== id));
    if (selectedParserId === id) {
      setSelectedParserId('raw');
    }
  };

  return (
    <div className="h-full flex flex-col safe-top safe-bottom bg-slate-900 text-slate-100 font-sans">
      {/* Dynamic Background Mesh */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/40 rounded-full blur-3xl filter" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/40 rounded-full blur-3xl filter" />
      </div>

      {/* Modern Header */}
      <header className="relative z-20 px-6 py-4 flex flex-col gap-4 bg-gradient-to-b from-slate-900 via-slate-900/90 to-transparent">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-10-8a3 3 0 013-3h6a3 3 0 013 3v4a3 3 0 01-3 3H9a3 3 0 01-3-3v-4z" />
                    </svg>
                </div>
                <h1 className="text-lg font-bold tracking-tight text-white">QuickVoice</h1>
            </div>
            
            {/* Sync Indicator + Settings */}
            <div className="flex items-center gap-2">
                {isSyncing && (
                    <div className="flex items-center gap-1 text-indigo-400">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                        <span className="text-xs font-medium">Syncing</span>
                    </div>
                )}
                <button 
                    onClick={openSettings}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>
        </div>

        {/* Parser Pill Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mask-linear-fade">
          {parsers.map(parser => (
            <button
              key={parser.id}
              onClick={() => setSelectedParserId(parser.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 border backdrop-blur-sm ${
                selectedParserId === parser.id 
                  ? 'bg-white text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.15)] scale-105' 
                  : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-800'
              }`}
            >
              {parser.name}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative group mt-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcripts..."
                className="block w-full pl-10 pr-10 py-2.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:bg-slate-800 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-sm transition-all backdrop-blur-md shadow-sm"
            />
            {searchQuery && (
                <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Recorder Area - Fixed at top/middle */}
        <div className="shrink-0">
          <Recorder 
            onRecordingComplete={handleRecordingComplete} 
          />
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative no-scrollbar mask-image-b">
           {/* Fade overlay at top of list */}
           <div className="sticky top-0 h-4 bg-gradient-to-b from-slate-900 to-transparent z-10 pointer-events-none" />
           
           <NotesList 
            notes={filteredNotes} 
            parsers={parsers} 
            onNoteSelect={openNote} 
            onDelete={deleteNote}
            onRetry={retryProcessing}
            isSearching={!!searchQuery}
          />
        </div>
      </main>

      {/* Note Detail Overlay */}
      {currentView === 'detail' && activeNote && (
        <NoteDetail 
          note={activeNote} 
          parser={parsers.find(p => p.id === activeNote.parserId)}
          onBack={() => setCurrentView('main')}
        />
      )}

      {/* Settings Overlay */}
      {currentView === 'settings' && (
        <Settings
          parsers={parsers}
          onBack={() => setCurrentView('main')}
          onAddParser={handleAddParser}
          onDeleteParser={handleDeleteParser}
        />
      )}

      {/* Offline Toast */}
      {!navigator.onLine && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-amber-500/90 backdrop-blur text-white text-[11px] font-bold px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 border border-amber-400/20">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414" />
          </svg>
          OFFLINE
        </div>
      )}
    </div>
  );
};

export default App;
