import React, { useState, useEffect } from 'react';
import { Parser } from '../types';
import { isCloudEnabled } from '../services/supabase';

interface SettingsProps {
  parsers: Parser[];
  onBack: () => void;
  onAddParser: (parser: Parser) => void;
  onDeleteParser: (id: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ parsers, onBack, onAddParser, onDeleteParser }) => {
  const [gdriveStatus, setGdriveStatus] = useState<{ connected: boolean; loading: boolean }>({
    connected: false,
    loading: true
  });
  const [showAddParser, setShowAddParser] = useState(false);
  const [newParser, setNewParser] = useState({ id: '', name: '', description: '', systemPrompt: '' });

  useEffect(() => {
    checkGDriveStatus();
    
    // Check URL for OAuth callback
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
    if (!confirm('Disconnect Google Drive? Your existing backups will remain in Drive.')) return;
    
    try {
      await fetch('/api/gdrive/auth', { method: 'DELETE' });
      setGdriveStatus({ connected: false, loading: false });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleAddParser = async () => {
    if (!newParser.id || !newParser.name || !newParser.systemPrompt) {
      alert('ID, Name, and System Prompt are required');
      return;
    }

    try {
      const response = await fetch('/api/parsers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newParser.id.toLowerCase().replace(/\s+/g, '-'),
          name: newParser.name,
          description: newParser.description,
          system_prompt: newParser.systemPrompt
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const { parser } = await response.json();
      onAddParser({
        id: parser.id,
        name: parser.name,
        description: parser.description || '',
        systemPrompt: parser.system_prompt,
        isDefault: false
      });

      setNewParser({ id: '', name: '', description: '', systemPrompt: '' });
      setShowAddParser(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add parser');
    }
  };

  const handleDeleteParser = async (id: string, isDefault?: boolean) => {
    if (isDefault) {
      alert('Cannot delete default parsers');
      return;
    }
    if (!confirm('Delete this parser?')) return;

    try {
      await fetch(`/api/parsers?id=${id}`, { method: 'DELETE' });
      onDeleteParser(id);
    } catch (error) {
      console.error('Delete parser error:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 animate-[slideUp_0.3s_ease-out]">
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <header className="p-4 safe-top border-b border-slate-800">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-300 hover:bg-slate-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">Settings</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto safe-bottom p-6 space-y-8">
        {/* Cloud Status */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Cloud Sync</h2>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isCloudEnabled() ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className="text-slate-200">
                  {isCloudEnabled() ? 'Supabase Connected' : 'Local Only Mode'}
                </span>
              </div>
              {!isCloudEnabled() && (
                <span className="text-xs text-slate-500">Configure env vars</span>
              )}
            </div>
          </div>
        </section>

        {/* Google Drive */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Google Drive Backup</h2>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            {gdriveStatus.loading ? (
              <div className="text-slate-400">Checking status...</div>
            ) : gdriveStatus.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.25 17.292l-4.5-4.364 1.857-1.858 2.643 2.506 5.643-5.784 1.857 1.857-7.5 7.643z"/>
                  </svg>
                  <span className="text-slate-200">Google Drive Connected</span>
                </div>
                <p className="text-xs text-slate-500">
                  Notes are automatically backed up to your OmniScribe folder
                </p>
                <button
                  onClick={disconnectGDrive}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-400 text-sm">
                  Back up your recordings and transcripts to Google Drive
                </p>
                <button
                  onClick={connectGDrive}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-lg font-medium text-sm hover:bg-slate-100"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Connect Google Drive
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Custom Parsers */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Parsers</h2>
            <button
              onClick={() => setShowAddParser(!showAddParser)}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              {showAddParser ? 'Cancel' : '+ Add Parser'}
            </button>
          </div>

          {/* Add Parser Form */}
          {showAddParser && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-indigo-500/30 mb-4 space-y-3">
              <input
                type="text"
                placeholder="Parser ID (e.g., my-parser)"
                value={newParser.id}
                onChange={(e) => setNewParser({ ...newParser, id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 text-sm"
              />
              <input
                type="text"
                placeholder="Display Name"
                value={newParser.name}
                onChange={(e) => setNewParser({ ...newParser, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 text-sm"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newParser.description}
                onChange={(e) => setNewParser({ ...newParser, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 text-sm"
              />
              <textarea
                placeholder="System Prompt (instructions for the AI)"
                value={newParser.systemPrompt}
                onChange={(e) => setNewParser({ ...newParser, systemPrompt: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 text-sm resize-none"
              />
              <button
                onClick={handleAddParser}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm"
              >
                Add Parser
              </button>
            </div>
          )}

          {/* Parser List */}
          <div className="space-y-2">
            {parsers.map(parser => (
              <div
                key={parser.id}
                className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-start justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-medium">{parser.name}</span>
                    {parser.isDefault && (
                      <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{parser.description}</p>
                </div>
                {!parser.isDefault && (
                  <button
                    onClick={() => handleDeleteParser(parser.id, parser.isDefault)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">About</h2>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">
              OmniScribe v1.0.0
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Voice-first note taking with AI transcription powered by Gemini.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Settings;
