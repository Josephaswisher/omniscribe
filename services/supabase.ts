import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Cloud sync disabled.');
}

export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface DBNote {
  id: string;
  created_at: string;
  duration: number;
  audio_url: string | null;
  transcript: string | null;
  parsed_summary: string | null;
  parser_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message: string | null;
  gdrive_audio_id: string | null;
  gdrive_transcript_id: string | null;
  title: string | null;
  word_count: number | null;
}

export interface DBParser {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  is_default: boolean;
  created_at: string;
}

export interface GDriveTokens {
  id: number;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  folder_id: string | null;
  updated_at: string;
}

export async function uploadAudio(noteId: string, blob: Blob): Promise<string | null> {
  if (!supabase) return null;
  
  const fileName = `${noteId}.${getExtension(blob.type)}`;
  const { data, error } = await supabase.storage
    .from('audio')
    .upload(fileName, blob, {
      contentType: blob.type,
      upsert: true
    });

  if (error) {
    console.error('Audio upload error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function deleteAudio(noteId: string): Promise<void> {
  if (!supabase) return;
  
  // Try common extensions
  const extensions = ['mp4', 'webm', 'ogg', 'wav'];
  for (const ext of extensions) {
    await supabase.storage.from('audio').remove([`${noteId}.${ext}`]);
  }
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/mp4': 'mp4',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3'
  };
  return map[mimeType] || 'mp4';
}

export async function fetchParsers(): Promise<DBParser[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('parsers')
    .select('*')
    .order('is_default', { ascending: false });
  
  if (error) {
    console.error('Fetch parsers error:', error);
    return [];
  }
  
  return data || [];
}

export async function fetchNotes(): Promise<DBNote[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Fetch notes error:', error);
    return [];
  }
  
  return data || [];
}

export async function saveNote(note: Partial<DBNote>): Promise<DBNote | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('notes')
    .upsert(note)
    .select()
    .single();
  
  if (error) {
    console.error('Save note error:', error);
    return null;
  }
  
  return data;
}

export async function deleteNoteFromCloud(id: string): Promise<boolean> {
  if (!supabase) return false;
  
  await deleteAudio(id);
  
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  
  return !error;
}

export async function getGDriveTokens(): Promise<GDriveTokens | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('gdrive_tokens')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (error) return null;
  return data;
}

export async function saveGDriveTokens(tokens: Partial<GDriveTokens>): Promise<void> {
  if (!supabase) return;
  
  await supabase
    .from('gdrive_tokens')
    .upsert({ id: 1, ...tokens, updated_at: new Date().toISOString() });
}

export function isCloudEnabled(): boolean {
  return supabase !== null;
}
