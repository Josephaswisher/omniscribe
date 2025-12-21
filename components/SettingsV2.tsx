import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Cloud, CloudOff, Moon, Sun, Monitor, Smartphone, 
  HardDrive, Vibrate, Zap, ChevronRight, ExternalLink,
  Info, Database, Trash2
} from 'lucide-react';
import { AppSettings, ThemeMode } from '../types';
import { isCloudEnabled } from '../services/supabase';
import { isLocalTranscriptionAvailable } from '../geminiService';

interface SettingsV2Props {
  settings: AppSettings;
  onBack: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onClearData: () => void;
  onOpenTemplateBuilder: () => void;
  storageUsed?: number;
  noteCount?: number;
}

const SettingsV2: React.FC<SettingsV2Props> = ({
  settings,
  onBack,
  onSettingsChange,
  onClearData,
  onOpenTemplateBuilder,
  storageUsed = 0,
  noteCount = 0,
}) => {
  const [gdriveStatus, setGdriveStatus] = useState<{ connected: boolean; loading: boolean }>({
    connected: false,
    loading: true
  });

  useEffect(() => {
    checkGDriveStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('gdrive') === 'connected') {
      setGdriveStatus({ connected: true, loading: false });
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const checkGDriveStatus = async () => {
    try {
      const response = await fetch('/api/gdrive/auth?action=status');
      const data = await response.json();
      setGdriveStatus({ connected: data.connected, loading: false });
    } catch {
      setGdriveStatus({ connected: false, loading: false });
    }
  };

  const connectGDrive = async () => {
    try {
      const response = await fetch('/api/gdrive/auth?action=url');
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
    }
  };

  const disconnectGDrive = async () => {
    if (!confirm('Disconnect Google Drive?')) return;
    try {
      await fetch('/api/gdrive/auth', { method: 'DELETE' });
      setGdriveStatus({ connected: false, loading: false });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const formatStorage = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const themeOptions: { value: ThemeMode; icon: React.ElementType; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  const SettingRow: React.FC<{
    icon: React.ElementType;
    label: string;
    description?: string;
    action?: React.ReactNode;
    onClick?: () => void;
  }> = ({ icon: Icon, label, description, action, onClick }) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-4 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl ${
        onClick ? 'hover:bg-slate-800/60 cursor-pointer' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <div className="flex-1 text-left">
        <span className="text-slate-200 font-medium">{label}</span>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {action || (onClick && <ChevronRight className="w-5 h-5 text-slate-500" />)}
    </button>
  );

  const Toggle: React.FC<{ enabled: boolean; onChange: (value: boolean) => void }> = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-12 h-7 rounded-full transition-colors relative ${
        enabled ? 'bg-indigo-500' : 'bg-slate-600'
      }`}
    >
      <motion.div
        animate={{ x: enabled ? 22 : 2 }}
        className="absolute top-1 w-5 h-5 bg-white rounded-full shadow"
      />
    </button>
  );

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-900"
    >
      {/* Header */}
      <header className="safe-top px-4 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-bold text-white">Settings</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto safe-bottom p-4 space-y-6">
        {/* Appearance */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Appearance
          </h2>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
            <label className="text-sm text-slate-400 mb-3 block">Theme</label>
            <div className="flex gap-2">
              {themeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => onSettingsChange({ theme: option.value })}
                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all ${
                    settings.theme === option.value
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <option.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Cloud Sync */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Cloud & Sync
          </h2>
          <div className="space-y-3">
            <SettingRow
              icon={isCloudEnabled() ? Cloud : CloudOff}
              label="Supabase Sync"
              description={isCloudEnabled() ? 'Connected and syncing' : 'Running in local mode'}
              action={
                <div className={`w-3 h-3 rounded-full ${isCloudEnabled() ? 'bg-green-500' : 'bg-amber-500'}`} />
              }
            />

            {/* Transcription Mode Indicator */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Info className="w-5 h-5 text-slate-400" />
                <span className="text-slate-200 font-medium">Transcription Mode</span>
              </div>
              <p className="text-xs text-slate-500">
                {isCloudEnabled() 
                  ? '☁️ Cloud: Using Vercel API + Gemini'
                  : isLocalTranscriptionAvailable()
                    ? '💻 Local: Using browser + Gemini API'
                    : '⚠️ No transcription available - configure VITE_GEMINI_API_KEY'
                }
              </p>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-200">Google Drive Backup</span>
                </div>
                {gdriveStatus.loading ? (
                  <span className="text-xs text-slate-500">Checking...</span>
                ) : gdriveStatus.connected ? (
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {gdriveStatus.connected 
                  ? 'Notes are backed up to your Google Drive' 
                  : 'Back up recordings and transcripts to Google Drive'}
              </p>
              {gdriveStatus.connected ? (
                <button
                  onClick={disconnectGDrive}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={connectGDrive}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-lg font-medium text-sm hover:bg-slate-100"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Connect Google Drive
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Preferences
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <span className="text-slate-200 font-medium">Auto-transcribe</span>
                  <p className="text-xs text-slate-500">Start processing immediately</p>
                </div>
              </div>
              <Toggle
                enabled={settings.autoTranscribe}
                onChange={(value) => onSettingsChange({ autoTranscribe: value })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                  <Vibrate className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <span className="text-slate-200 font-medium">Haptic Feedback</span>
                  <p className="text-xs text-slate-500">Vibrate on interactions</p>
                </div>
              </div>
              <Toggle
                enabled={settings.hapticFeedback}
                onChange={(value) => onSettingsChange({ hapticFeedback: value })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <span className="text-slate-200 font-medium">Compact Mode</span>
                  <p className="text-xs text-slate-500">Smaller note cards</p>
                </div>
              </div>
              <Toggle
                enabled={settings.compactMode}
                onChange={(value) => onSettingsChange({ compactMode: value })}
              />
            </div>
          </div>
        </section>

        {/* Templates */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Templates
          </h2>
          <SettingRow
            icon={Zap}
            label="Template Builder"
            description="Create custom AI processing templates"
            onClick={onOpenTemplateBuilder}
          />
        </section>

        {/* Data & Storage */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Data & Storage
          </h2>
          <div className="space-y-3">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-4 mb-4">
                <Database className="w-5 h-5 text-slate-400" />
                <div className="flex-1">
                  <span className="text-slate-200 font-medium">Local Storage</span>
                  <p className="text-xs text-slate-500">{noteCount} notes • {formatStorage(storageUsed)}</p>
                </div>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.min(100, (storageUsed / (50 * 1024 * 1024)) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {formatStorage(50 * 1024 * 1024 - storageUsed)} available
              </p>
            </div>

            <button
              onClick={() => {
                if (confirm('Clear all local data? This cannot be undone.')) {
                  onClearData();
                }
              }}
              className="w-full flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="w-5 h-5" />
              <span className="font-medium">Clear All Data</span>
            </button>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            About
          </h2>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-10-8a3 3 0 013-3h6a3 3 0 013 3v4a3 3 0 01-3 3H9a3 3 0 01-3-3v-4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold">OmniScribe</h3>
                <p className="text-sm text-slate-500">Version 2.0.0</p>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Voice-first note taking with AI-powered transcription and organization.
            </p>
          </div>
        </section>
      </main>
    </motion.div>
  );
};

export default SettingsV2;
