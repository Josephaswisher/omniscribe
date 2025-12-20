import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export const config = {
  runtime: 'edge'
};

export async function POST(request: Request) {
  try {
    const { noteId } = await request.json();

    if (!noteId) {
      return Response.json({ error: 'noteId required' }, { status: 400 });
    }

    // Get tokens
    const { data: tokens } = await supabase
      .from('gdrive_tokens')
      .select('*')
      .eq('id', 1)
      .single();

    if (!tokens?.access_token) {
      return Response.json({ error: 'Google Drive not connected' }, { status: 401 });
    }

    // Refresh token if expired
    let accessToken = tokens.access_token;
    if (new Date(tokens.expires_at) < new Date()) {
      accessToken = await refreshAccessToken(tokens.refresh_token);
    }

    // Get note
    const { data: note } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (!note) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    // Create month folder
    const monthFolder = await getOrCreateMonthFolder(accessToken, tokens.folder_id);

    // Upload audio
    let audioFileId = note.gdrive_audio_id;
    if (note.audio_url && !audioFileId) {
      const audioResponse = await fetch(note.audio_url);
      const audioBlob = await audioResponse.blob();
      audioFileId = await uploadFileToDrive(
        accessToken,
        monthFolder,
        `${noteId}.mp4`,
        audioBlob,
        'audio/mp4'
      );
    }

    // Upload transcript
    let transcriptFileId = note.gdrive_transcript_id;
    if (note.transcript && !transcriptFileId) {
      const content = formatTranscriptFile(note);
      const textBlob = new Blob([content], { type: 'text/plain' });
      transcriptFileId = await uploadFileToDrive(
        accessToken,
        monthFolder,
        `${noteId}.txt`,
        textBlob,
        'text/plain'
      );
    }

    // Update note with Drive IDs
    await supabase
      .from('notes')
      .update({
        gdrive_audio_id: audioFileId,
        gdrive_transcript_id: transcriptFileId
      })
      .eq('id', noteId);

    return Response.json({ 
      success: true, 
      audioFileId, 
      transcriptFileId 
    });
  } catch (error) {
    console.error('GDrive sync error:', error);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const tokens = await response.json();
  
  // Update stored token
  await supabase
    .from('gdrive_tokens')
    .update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  return tokens.access_token;
}

async function getOrCreateMonthFolder(accessToken: string, parentId: string): Promise<string> {
  const now = new Date();
  const folderName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Check if exists
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  const searchResult = await searchResponse.json();
  
  if (searchResult.files?.length > 0) {
    return searchResult.files[0].id;
  }

  // Create folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });

  const folder = await createResponse.json();
  return folder.id;
}

async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: Blob,
  mimeType: string
): Promise<string> {
  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', content);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: form
    }
  );

  const file = await response.json();
  return file.id;
}

function formatTranscriptFile(note: any): string {
  const date = new Date(note.created_at).toLocaleString();
  let content = `OmniScribe Note\n`;
  content += `Date: ${date}\n`;
  content += `Duration: ${Math.round(note.duration)}s\n`;
  content += `Parser: ${note.parser_id}\n`;
  content += `\n--- TRANSCRIPT ---\n\n`;
  content += note.transcript || '(No transcript)';
  
  if (note.parsed_summary) {
    content += `\n\n--- AI SUMMARY ---\n\n`;
    content += note.parsed_summary;
  }
  
  return content;
}
