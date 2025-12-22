import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Settings,
  Upload,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { db } from "./db";
import {
  VoiceNote,
  Parser,
  Folder,
  Tag,
  Action,
  Template,
  TabId,
  AppView,
  AppSettings,
  ThemeMode,
} from "./types";
import { DEFAULT_PARSERS } from "./constants";
import { transcribeAndParse } from "./geminiService";
import { isCloudEnabled } from "./services/supabase";
import {
  syncNoteToCloud,
  loadParsersFromCloud,
  mergeLocalAndCloud,
} from "./services/sync";
import { syncNoteToGDrive, checkGDriveConnection } from "./services/gdrive";
import { registerServiceWorker } from "./registerSW";
import { applyTheme, getTheme, darkTheme } from "./theme";

// Components
import TabBar from "./components/TabBar";
import HomeView from "./components/HomeView";
import FoldersView from "./components/FoldersView";
import RecorderV2 from "./components/RecorderV2";
import SearchView from "./components/SearchView";
import ActionsHub from "./components/ActionsHub";
import NoteDetailV2 from "./components/NoteDetailV2";
import SettingsV2 from "./components/SettingsV2";
import TemplateBuilder from "./components/TemplateBuilder";
import AnalyticsView from "./components/AnalyticsView";
import { AssistantChat } from "./components/AssistantChat";
import { useToast, UploadErrors } from "./components/Toast";

const defaultSettings: AppSettings = {
  cloudSyncEnabled: true,
  gdriveBackupEnabled: false,
  autoTranscribe: true,
  defaultParserId: "raw",
  theme: "dark",
  compactMode: false,
  hapticFeedback: true,
};

const App: React.FC = () => {
  // Core State
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [parsers, setParsers] = useState<Parser[]>(DEFAULT_PARSERS);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  // UI State
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [currentView, setCurrentView] = useState<AppView>("main");
  const [activeNote, setActiveNote] = useState<VoiceNote | null>(null);
  const [selectedParserId, setSelectedParserId] = useState<string>(
    DEFAULT_PARSERS[0].id,
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [gdriveConnected, setGdriveConnected] = useState(false);

  // Toast notifications
  const { showError, showSuccess } = useToast();

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick chat state
  const [quickChatInput, setQuickChatInput] = useState("");
  const [quickChatInitialMessage, setQuickChatInitialMessage] = useState<
    string | null
  >(null);

  // Supported audio types for upload
  const ACCEPTED_TYPES = [
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/mp4a-latm",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
  ];

  // Initialize
  useEffect(() => {
    const init = async () => {
      registerServiceWorker();
      await db.init();

      // Apply theme
      applyTheme(getTheme(settings.theme));

      // Load data
      if (isCloudEnabled()) {
        const cloudParsers = await loadParsersFromCloud();
        if (cloudParsers.length > 0) setParsers(cloudParsers);

        const gdriveStatus = await checkGDriveConnection();
        setGdriveConnected(gdriveStatus);

        const mergedNotes = await mergeLocalAndCloud();
        setNotes(mergedNotes);
      } else {
        const savedNotes = await db.getAllNotes();
        setNotes(savedNotes);
      }

      // Load local settings
      const savedSettings = localStorage.getItem("omniscribe_settings");
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }

      // Initialize default folders and tags (simulated for now)
      setFolders([
        {
          id: "1",
          name: "Personal",
          color: "#10b981",
          icon: "user",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "2",
          name: "Work",
          color: "#3b82f6",
          icon: "briefcase",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "3",
          name: "Ideas",
          color: "#f59e0b",
          icon: "lightbulb",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      setTags([
        { id: "1", name: "important", color: "#ef4444" },
        { id: "2", name: "follow-up", color: "#f59e0b" },
        { id: "3", name: "meeting", color: "#3b82f6" },
        { id: "4", name: "idea", color: "#8b5cf6" },
      ]);
    };
    init();
  }, []);

  // Save settings on change
  useEffect(() => {
    localStorage.setItem("omniscribe_settings", JSON.stringify(settings));
    applyTheme(getTheme(settings.theme));
  }, [settings]);

  // Process note
  const processNote = useCallback(
    async (note: VoiceNote) => {
      const processingNote: VoiceNote = { ...note, status: "processing" };
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? processingNote : n)),
      );
      await db.saveNote(processingNote);

      try {
        let updatedNote: VoiceNote;

        if (isCloudEnabled()) {
          setIsSyncing(true);
          const result = await syncNoteToCloud(processingNote);
          setIsSyncing(false);

          if (result.success && result.note) {
            updatedNote = result.note;
            if (gdriveConnected) {
              syncNoteToGDrive(updatedNote.id).catch(console.error);
            }
          } else {
            throw new Error(result.error || "Cloud sync failed");
          }
        } else {
          const selectedParser =
            parsers.find((p) => p.id === note.parserId) || DEFAULT_PARSERS[0];
          const result = await transcribeAndParse(
            note.audioBlob,
            selectedParser,
          );

          updatedNote = {
            ...processingNote,
            transcript: result.transcript,
            parsedSummary: result.summary,
            title: result.title,
            status: "completed",
            wordCount: result.transcript.split(/\s+/).length,
            segments: result.segments?.map((seg, idx) => ({
              ...seg,
              id: `${note.id}-seg-${idx}`,
              note_id: note.id,
            })),
            detectedLanguage: result.detectedLanguage,
            languageCode: result.languageCode,
          };
        }

        // Extract actions from todo parser
        if (note.parserId === "todo" && updatedNote.parsedSummary) {
          const extractedActions = extractActionsFromSummary(
            updatedNote.parsedSummary,
            updatedNote.id,
          );
          setActions((prev) => [...prev, ...extractedActions]);
        }

        await db.saveNote(updatedNote);
        setNotes((prev) =>
          prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)),
        );
      } catch (err) {
        console.error("Processing failed", err);
        const errorNote: VoiceNote = {
          ...processingNote,
          status: "error",
          errorMessage:
            err instanceof Error ? err.message : "Processing failed",
        };
        await db.saveNote(errorNote);
        setNotes((prev) =>
          prev.map((n) => (n.id === errorNote.id ? errorNote : n)),
        );
        setIsSyncing(false);
      }
    },
    [parsers, gdriveConnected],
  );

  // Extract actions from summary
  const extractActionsFromSummary = (
    summary: string,
    noteId: string,
  ): Action[] => {
    const lines = summary.split("\n");
    const actions: Action[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("-") ||
        trimmed.startsWith("•") ||
        trimmed.match(/^\d+\./)
      ) {
        const content = trimmed
          .replace(/^[-•]\s*/, "")
          .replace(/^\d+\.\s*/, "");
        if (content.length > 5) {
          actions.push({
            id: crypto.randomUUID(),
            noteId,
            content,
            status: "pending",
            priority: "medium",
            createdAt: Date.now(),
          });
        }
      }
    });

    return actions;
  };

  // Background sync
  useEffect(() => {
    const syncPending = async () => {
      if (!navigator.onLine) return;
      const dbNotes = await db.getAllNotes();
      const pendingNotes = dbNotes.filter((n) => n.status === "pending");
      for (const note of pendingNotes) {
        await processNote(note);
      }
    };

    const handleOnline = () => syncPending();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncPending();
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(syncPending, 30000);
    syncPending();

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [processNote]);

  // Handlers
  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    const isOffline = !navigator.onLine;
    const newNote: VoiceNote = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      duration,
      audioBlob: blob,
      parserId: selectedParserId,
      status: isOffline ? "pending" : "processing",
      source: "recorded",
    };

    setNotes((prev) => [newNote, ...prev]);
    await db.saveNote(newNote);
    setIsRecording(false);

    if (!isOffline && settings.autoTranscribe) {
      processNote(newNote);
    }
  };

  // Handle uploaded audio file
  const handleFileUpload = async (file: File, duration: number) => {
    setIsUploading(true);
    const isOffline = !navigator.onLine;

    try {
      // Convert File to Blob (File extends Blob, but ensure proper typing)
      const audioBlob = new Blob([await file.arrayBuffer()], {
        type: file.type,
      });

      const newNote: VoiceNote = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        duration: Math.round(duration),
        audioBlob,
        parserId: selectedParserId,
        status: isOffline ? "pending" : "processing",
        title: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension as title
        source: "uploaded",
        uploadedFileType: file.type || file.name.split(".").pop(),
        uploadedFileSize: file.size,
      };

      setNotes((prev) => [newNote, ...prev]);
      await db.saveNote(newNote);
      setIsUploading(false);

      // Success feedback
      showSuccess(
        "Audio uploaded",
        isOffline
          ? "Will transcribe when back online"
          : "Processing transcription...",
      );

      if (!isOffline && settings.autoTranscribe) {
        processNote(newNote);
      }

      // Haptic feedback
      if (settings.hapticFeedback && "vibrate" in navigator) {
        navigator.vibrate([30, 30]);
      }
    } catch (err) {
      console.error("[App] Failed to process uploaded file:", err);
      setIsUploading(false);
      showError(
        UploadErrors.PROCESSING_FAILED.title,
        UploadErrors.PROCESSING_FAILED.description,
        () => handleFileUpload(file, duration), // Retry with same file
      );
    }
  };

  const handleNoteSelect = (note: VoiceNote) => {
    setActiveNote(note);
    setCurrentView("detail");
  };

  const handleNoteDelete = async (id: string) => {
    await db.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNote?.id === id) {
      setCurrentView("main");
      setActiveNote(null);
    }
  };

  const handleNotePin = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n)),
    );
  };

  const handleNoteUpdate = async (updates: Partial<VoiceNote>) => {
    if (!activeNote) return;
    const updatedNote = { ...activeNote, ...updates };
    setNotes((prev) =>
      prev.map((n) => (n.id === activeNote.id ? updatedNote : n)),
    );
    setActiveNote(updatedNote);
    await db.saveNote(updatedNote);
  };

  const handleTabChange = (tab: TabId) => {
    if (tab === "record") {
      setIsRecording(true);
    } else {
      setActiveTab(tab);
    }
  };

  const handleFolderCreate = (name: string, color: string) => {
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      color,
      icon: "folder",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  const handleFolderUpdate = (id: string, name: string, color: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, name, color, updatedAt: Date.now() } : f,
      ),
    );
  };

  const handleFolderDelete = (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setNotes((prev) =>
      prev.map((n) => (n.folderId === id ? { ...n, folderId: undefined } : n)),
    );
  };

  const handleActionToggle = (id: string, status: Action["status"]) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              completedAt: status === "completed" ? Date.now() : undefined,
            }
          : a,
      ),
    );
  };

  const handleActionUpdate = (id: string, updates: Partial<Action>) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  };

  const handleActionDelete = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleCreateTemplate = (
    template: Omit<Template, "id" | "createdAt" | "usageCount">,
  ) => {
    const newTemplate: Template = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      usageCount: 0,
    };
    setTemplates((prev) => [...prev, newTemplate]);
  };

  const handleUseTemplateAsParser = (template: Template) => {
    const newParser: Parser = {
      id: template.id,
      name: template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
    };
    setParsers((prev) => [...prev, newParser]);
  };

  const pendingActionsCount = actions.filter(
    (a) => a.status === "pending",
  ).length;

  // Handle quick chat submission
  const handleQuickChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickChatInput.trim()) return;
    setQuickChatInitialMessage(quickChatInput.trim());
    setQuickChatInput("");
    setCurrentView("assistant");
  };

  return (
    <div className="h-full flex flex-col bg-terminal-bg text-neutral-100 font-sans">
      {/* Background - subtle grid */}
      <div className="fixed inset-0 pointer-events-none grid-bg opacity-50" />

      {/* Subtle RGB glow accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rgb-cyan/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rgb-green/5 rounded-full blur-[120px]" />
      </div>

      {/* Futuristic Side Bars - Black/Purple Gradient */}
      <div className="fixed left-0 top-0 bottom-0 w-1 z-30 pointer-events-none">
        <div className="h-full w-full bg-gradient-to-b from-purple-500 via-violet-600 to-black opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-400/50 via-transparent to-purple-500/30 animate-pulse" />
      </div>
      <div className="fixed right-0 top-0 bottom-0 w-1 z-30 pointer-events-none">
        <div className="h-full w-full bg-gradient-to-b from-black via-violet-600 to-purple-500 opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/30 via-transparent to-purple-400/50 animate-pulse" />
      </div>
      {/* Side glow effect */}
      <div className="fixed left-0 top-0 bottom-0 w-8 z-20 pointer-events-none bg-gradient-to-r from-purple-500/10 to-transparent" />
      <div className="fixed right-0 top-0 bottom-0 w-8 z-20 pointer-events-none bg-gradient-to-l from-purple-500/10 to-transparent" />

      {/* Header */}
      <header className="relative z-20 px-4 py-4 safe-top flex items-center justify-between border-b border-terminal-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-terminal-surface border border-terminal-border rounded-lg flex items-center justify-center glow-cyan">
            <svg
              className="w-5 h-5 text-rgb-cyan"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-10-8a3 3 0 013-3h6a3 3 0 013 3v4a3 3 0 01-3 3H9a3 3 0 01-3-3v-4z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white font-mono tracking-tight">
              OmniScribe
            </h1>
            {isSyncing && (
              <span className="text-[10px] text-rgb-cyan flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 bg-rgb-cyan rounded-full animate-pulse" />
                SYNCING...
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Hidden file input for upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // Extract duration and call handleFileUpload
                const audioCtx = new (
                  window.AudioContext || (window as any).webkitAudioContext
                )();
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  try {
                    const arrayBuffer = ev.target?.result as ArrayBuffer;
                    const audioBuffer =
                      await audioCtx.decodeAudioData(arrayBuffer);
                    audioCtx.close();
                    handleFileUpload(file, audioBuffer.duration);
                  } catch {
                    audioCtx.close();
                    // Fallback to audio element
                    const audio = new Audio();
                    audio.src = URL.createObjectURL(file);
                    audio.onloadedmetadata = () => {
                      URL.revokeObjectURL(audio.src);
                      handleFileUpload(file, audio.duration);
                    };
                    audio.onerror = () => {
                      URL.revokeObjectURL(audio.src);
                      showError(
                        "Cannot read audio file",
                        "The file may be corrupted or unsupported.",
                      );
                    };
                  }
                };
                reader.readAsArrayBuffer(file);
              }
              e.target.value = "";
            }}
            className="hidden"
          />
          {/* Upload button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
              isUploading
                ? "bg-rgb-cyan/20 border-rgb-cyan"
                : "bg-terminal-surface border-terminal-border text-neutral-500 hover:text-rgb-cyan hover:border-rgb-cyan"
            }`}
            title="Upload audio file"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-rgb-cyan animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </motion.button>
          {/* Settings button */}
          <button
            onClick={() => setCurrentView("settings")}
            className="w-10 h-10 rounded-lg bg-terminal-surface border border-terminal-border flex items-center justify-center text-neutral-500 hover:text-white hover:border-terminal-muted transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Ask AI Subheader with Inline Chat */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 px-4 py-2 border-b border-terminal-border bg-gradient-to-r from-purple-500/5 via-transparent to-violet-500/5"
      >
        <form
          onSubmit={handleQuickChatSubmit}
          className="flex items-center gap-2"
        >
          {/* AI Icon */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentView("assistant")}
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20"
            title="Open full chat"
          >
            <Sparkles className="w-4 h-4 text-white" />
          </motion.button>

          {/* Input Field */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={quickChatInput}
              onChange={(e) => setQuickChatInput(e.target.value)}
              placeholder="Ask anything about your notes..."
              className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-purple-500/20 focus:border-purple-500/50 focus:outline-none text-sm text-black font-mono transition-colors rgb-placeholder"
            />
            <style>{`
              .rgb-placeholder::placeholder {
                background: linear-gradient(90deg, #00ffff, #ff00ff, #00ff00, #00ffff);
                background-size: 300% 100%;
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: rgb-shift 3s linear infinite;
              }
              @keyframes rgb-shift {
                0% { background-position: 0% 50%; }
                100% { background-position: 300% 50%; }
              }
            `}</style>
          </div>

          {/* Send Button */}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!quickChatInput.trim()}
            className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              quickChatInput.trim()
                ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-purple-500/20"
                : "bg-terminal-surface border border-purple-500/20 text-purple-400/50"
            }`}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </form>
      </motion.div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {activeTab === "home" && (
          <HomeView
            notes={notes}
            parsers={parsers}
            folders={folders}
            tags={tags}
            onNoteSelect={handleNoteSelect}
            onNoteDelete={handleNoteDelete}
            onNotePin={handleNotePin}
            onRetry={(note) => processNote(note)}
            isSyncing={isSyncing}
          />
        )}

        {activeTab === "folders" && (
          <FoldersView
            folders={folders}
            notes={notes}
            onFolderSelect={(folder) => {
              /* Navigate to folder detail */
            }}
            onFolderCreate={handleFolderCreate}
            onFolderUpdate={handleFolderUpdate}
            onFolderDelete={handleFolderDelete}
          />
        )}

        {activeTab === "search" && (
          <SearchView
            notes={notes}
            parsers={parsers}
            folders={folders}
            tags={tags}
            onNoteSelect={handleNoteSelect}
          />
        )}

        {activeTab === "actions" && (
          <ActionsHub
            actions={actions}
            notes={notes}
            onActionToggle={handleActionToggle}
            onActionDelete={handleActionDelete}
            onActionUpdate={handleActionUpdate}
            onNoteSelect={(noteId) => {
              const note = notes.find((n) => n.id === noteId);
              if (note) handleNoteSelect(note);
            }}
          />
        )}
      </main>

      {/* Tab Bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        pendingActionsCount={pendingActionsCount}
      />

      {/* Recording Overlay */}
      <AnimatePresence>
        {isRecording && (
          <RecorderV2
            onRecordingComplete={handleRecordingComplete}
            parsers={parsers}
            selectedParserId={selectedParserId}
            onParserChange={setSelectedParserId}
            isFullScreen={true}
            onClose={() => setIsRecording(false)}
            onUploadFile={handleFileUpload}
            isUploading={isUploading}
          />
        )}
      </AnimatePresence>

      {/* Note Detail */}
      <AnimatePresence>
        {currentView === "detail" && activeNote && (
          <NoteDetailV2
            note={activeNote}
            parser={parsers.find((p) => p.id === activeNote.parserId)}
            folders={folders}
            tags={tags}
            templates={templates}
            onBack={() => setCurrentView("main")}
            onUpdate={handleNoteUpdate}
            onDelete={() => handleNoteDelete(activeNote.id)}
            onAddBookmark={(timestamp, label) => {
              const bookmark = {
                id: crypto.randomUUID(),
                noteId: activeNote.id,
                timestampSeconds: timestamp,
                label,
                createdAt: Date.now(),
              };
              const updatedBookmarks = [
                ...(activeNote.bookmarks || []),
                bookmark,
              ];
              handleNoteUpdate({ bookmarks: updatedBookmarks });
            }}
            onDeleteBookmark={(bookmarkId) => {
              const updatedBookmarks = activeNote.bookmarks?.filter(
                (b) => b.id !== bookmarkId,
              );
              handleNoteUpdate({ bookmarks: updatedBookmarks });
            }}
            onAddTag={(tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (tag) {
                const updatedTags = [...(activeNote.tags || []), tag];
                handleNoteUpdate({ tags: updatedTags });
              }
            }}
            onRemoveTag={(tagId) => {
              const updatedTags = activeNote.tags?.filter(
                (t) => t.id !== tagId,
              );
              handleNoteUpdate({ tags: updatedTags });
            }}
            onMoveToFolder={(folderId) =>
              handleNoteUpdate({ folderId: folderId || undefined })
            }
            onToggleTemplateFavorite={(templateId) => {
              setTemplates((prev) =>
                prev.map((t) =>
                  t.id === templateId ? { ...t, isFavorite: !t.isFavorite } : t,
                ),
              );
            }}
            onOpenTemplateBuilder={() => setCurrentView("template-builder")}
          />
        )}
      </AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {currentView === "settings" && (
          <SettingsV2
            settings={settings}
            onBack={() => setCurrentView("main")}
            onSettingsChange={(updates) =>
              setSettings((prev) => ({ ...prev, ...updates }))
            }
            onClearData={async () => {
              await db.init();
              setNotes([]);
              setActions([]);
            }}
            onOpenTemplateBuilder={() => setCurrentView("template-builder")}
            onOpenAnalytics={() => setCurrentView("analytics")}
            onOpenAssistant={() => setCurrentView("assistant")}
            noteCount={notes.length}
          />
        )}
      </AnimatePresence>

      {/* Template Builder */}
      <AnimatePresence>
        {currentView === "template-builder" && (
          <TemplateBuilder
            templates={templates}
            parsers={parsers}
            onBack={() => setCurrentView("settings")}
            onCreateTemplate={handleCreateTemplate}
            onUpdateTemplate={(id, updates) => {
              setTemplates((prev) =>
                prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
              );
            }}
            onDeleteTemplate={(id) =>
              setTemplates((prev) => prev.filter((t) => t.id !== id))
            }
            onUseAsParser={handleUseTemplateAsParser}
          />
        )}
      </AnimatePresence>

      {/* Analytics */}
      <AnimatePresence>
        {currentView === "analytics" && (
          <AnalyticsView
            notes={notes}
            actions={actions}
            parsers={parsers}
            onBack={() => setCurrentView("settings")}
          />
        )}
      </AnimatePresence>

      {/* AI Assistant Chat */}
      <AnimatePresence>
        {currentView === "assistant" && (
          <AssistantChat
            onClose={() => {
              setCurrentView("main");
              setQuickChatInitialMessage(null);
            }}
            initialMessage={quickChatInitialMessage}
          />
        )}
      </AnimatePresence>

      {/* Offline Toast */}
      {!navigator.onLine && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-rgb-yellow/90 backdrop-blur text-black text-xs font-mono font-bold px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 border border-rgb-yellow">
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829"
            />
          </svg>
          OFFLINE
        </div>
      )}
    </div>
  );
};

export default App;
