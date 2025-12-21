// OmniScribe V2.0 Types

export interface VoiceNote {
  id: string;
  createdAt: number;
  duration: number;
  audioBlob: Blob;
  audioUrl?: string;
  transcript?: string;
  parsedSummary?: string;
  parserId: string;
  status: "pending" | "processing" | "completed" | "error";
  errorMessage?: string;
  syncedToCloud?: boolean;
  gdriveAudioId?: string;
  gdriveTranscriptId?: string;
  // V2.0 additions
  folderId?: string;
  title?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  wordCount?: number;
  tags?: Tag[];
  bookmarks?: Bookmark[];
  actions?: Action[];
  // V3.0: Transcript-audio sync
  segments?: TranscriptSegment[];
  // V3.0: Multi-language support
  detectedLanguage?: string;
  languageCode?: string;
  // V3.1: Upload tracking
  source?: "recorded" | "uploaded";
  uploadedFileType?: string;
  uploadedFileSize?: number;
}

export interface Parser {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  isDefault?: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon: string;
  category: "default" | "productivity" | "creative" | "professional" | "custom";
  isPublic?: boolean;
  usageCount?: number;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  parentId?: string;
  noteCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  noteCount?: number;
}

export interface Bookmark {
  id: string;
  noteId: string;
  timestampSeconds: number;
  label?: string;
  createdAt: number;
}

export interface Action {
  id: string;
  noteId: string;
  content: string;
  status: "pending" | "completed" | "dismissed";
  priority: "low" | "medium" | "high";
  dueDate?: number;
  completedAt?: number;
  createdAt: number;
  noteTitle?: string;
}

export interface AnalyticsEvent {
  id: string;
  eventType: string;
  eventData: Record<string, unknown>;
  createdAt: number;
}

export interface Analytics {
  totalNotes: number;
  totalDuration: number;
  totalWords: number;
  notesThisWeek: number;
  avgDuration: number;
  topParsers: { parserId: string; count: number }[];
  activityByDay: { date: string; count: number }[];
  completedActions: number;
  pendingActions: number;
}

// V3.0 Transcript Segments for audio sync
export interface TranscriptSegment {
  id: string;
  note_id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_label?: string;
  confidence?: number;
}

// Navigation
export type TabId = "home" | "folders" | "record" | "search" | "actions";
export type AppView =
  | "main"
  | "detail"
  | "settings"
  | "template-builder"
  | "folder-detail"
  | "analytics"
  | "assistant";

// Theme
export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  border: string;
  primary: string;
  primaryHover: string;
  accent: string;
  error: string;
  success: string;
  warning: string;
}

// App State
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt?: number;
  cloudEnabled: boolean;
  gdriveConnected: boolean;
}

export interface AppSettings {
  cloudSyncEnabled: boolean;
  gdriveBackupEnabled: boolean;
  autoTranscribe: boolean;
  defaultParserId: string;
  theme: ThemeMode;
  compactMode: boolean;
  hapticFeedback: boolean;
}

export interface SearchFilters {
  query: string;
  folderId?: string;
  tags?: string[];
  dateRange?: { start: number; end: number };
  parserId?: string;
  status?: VoiceNote["status"];
  hasActions?: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  waveformData: number[];
}

// Component Props
export interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  pendingActionsCount?: number;
}

export interface WaveformProps {
  data: number[];
  isRecording: boolean;
  isPaused: boolean;
  progress?: number;
  height?: number;
  barWidth?: number;
  barGap?: number;
  primaryColor?: string;
  secondaryColor?: string;
}
