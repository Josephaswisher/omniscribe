import { VoiceNote, Parser } from '../types';
import { db } from '../db';
import { 
  isCloudEnabled, 
  fetchNotes as fetchCloudNotes, 
  fetchParsers as fetchCloudParsers,
  deleteNoteFromCloud,
  DBNote
} from './supabase';

const API_BASE = '/api';

export interface SyncResult {
  success: boolean;
  note?: VoiceNote;
  error?: string;
}

export async function syncNoteToCloud(note: VoiceNote): Promise<SyncResult> {
  if (!isCloudEnabled()) {
    return { success: false, error: 'Cloud sync not enabled' };
  }

  try {
    const formData = new FormData();
    formData.append('audio', note.audioBlob, `${note.id}.mp4`);
    formData.append('parserId', note.parserId);
    formData.append('noteId', note.id);
    formData.append('duration', note.duration.toString());
    formData.append('createdAt', new Date(note.createdAt).toISOString());

    const response = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Upload failed');
    }

    const { note: cloudNote } = await response.json();
    
    const updatedNote: VoiceNote = {
      ...note,
      transcript: cloudNote.transcript,
      parsedSummary: cloudNote.parsed_summary,
      audioUrl: cloudNote.audio_url,
      status: cloudNote.status,
      syncedToCloud: true
    };

    await db.saveNote(updatedNote);
    
    return { success: true, note: updatedNote };
  } catch (error) {
    console.error('Sync error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Sync failed' 
    };
  }
}

export async function syncPendingNotes(
  notes: VoiceNote[],
  onProgress?: (note: VoiceNote, success: boolean) => void
): Promise<{ synced: number; failed: number }> {
  const pendingNotes = notes.filter(n => n.status === 'pending' && !n.syncedToCloud);
  let synced = 0;
  let failed = 0;

  for (const note of pendingNotes) {
    const result = await syncNoteToCloud(note);
    if (result.success) {
      synced++;
      onProgress?.(result.note!, true);
    } else {
      failed++;
      onProgress?.(note, false);
    }
  }

  return { synced, failed };
}

export async function deleteNote(id: string): Promise<boolean> {
  await db.deleteNote(id);
  
  if (isCloudEnabled()) {
    await deleteNoteFromCloud(id);
  }
  
  return true;
}

export async function loadParsersFromCloud(): Promise<Parser[]> {
  if (!isCloudEnabled()) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE}/parsers`);
    if (!response.ok) throw new Error('Failed to fetch parsers');
    
    const { parsers } = await response.json();
    return parsers.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      systemPrompt: p.system_prompt,
      isDefault: p.is_default
    }));
  } catch (error) {
    console.error('Load parsers error:', error);
    return [];
  }
}

export async function loadNotesFromCloud(): Promise<VoiceNote[]> {
  if (!isCloudEnabled()) {
    return [];
  }

  try {
    const cloudNotes = await fetchCloudNotes();
    return cloudNotes.map(dbNoteToVoiceNote);
  } catch (error) {
    console.error('Load notes error:', error);
    return [];
  }
}

function dbNoteToVoiceNote(dbNote: DBNote): VoiceNote {
  return {
    id: dbNote.id,
    createdAt: new Date(dbNote.created_at).getTime(),
    duration: dbNote.duration,
    audioBlob: new Blob(), // Placeholder - actual audio loaded separately
    audioUrl: dbNote.audio_url || undefined,
    transcript: dbNote.transcript || undefined,
    parsedSummary: dbNote.parsed_summary || undefined,
    parserId: dbNote.parser_id,
    status: dbNote.status,
    errorMessage: dbNote.error_message || undefined,
    syncedToCloud: true,
    gdriveAudioId: dbNote.gdrive_audio_id || undefined,
    gdriveTranscriptId: dbNote.gdrive_transcript_id || undefined
  };
}

export async function retryNote(note: VoiceNote): Promise<SyncResult> {
  const updatedNote: VoiceNote = { ...note, status: 'pending' };
  await db.saveNote(updatedNote);
  return syncNoteToCloud(updatedNote);
}

export async function mergeLocalAndCloud(): Promise<VoiceNote[]> {
  const localNotes = await db.getAllNotes();
  
  if (!isCloudEnabled()) {
    return localNotes;
  }

  const cloudNotes = await loadNotesFromCloud();
  const mergedMap = new Map<string, VoiceNote>();

  // Add cloud notes first
  for (const note of cloudNotes) {
    mergedMap.set(note.id, note);
  }

  // Overlay local notes (local has actual blobs)
  for (const note of localNotes) {
    const existing = mergedMap.get(note.id);
    if (existing) {
      // Keep local blob but use cloud transcript/summary if available
      mergedMap.set(note.id, {
        ...note,
        transcript: existing.transcript || note.transcript,
        parsedSummary: existing.parsedSummary || note.parsedSummary,
        audioUrl: existing.audioUrl,
        syncedToCloud: existing.syncedToCloud
      });
    } else {
      mergedMap.set(note.id, note);
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}
