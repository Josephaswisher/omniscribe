import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

export const config = {
  runtime: 'edge'
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'url') {
    // Return OAuth URL for client to redirect to
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    return Response.json({ url: authUrl.toString() });
  }

  if (action === 'status') {
    // Check if connected
    const { data } = await supabase
      .from('gdrive_tokens')
      .select('access_token, expires_at, folder_id')
      .eq('id', 1)
      .single();

    const connected = !!data?.access_token;
    const expired = data?.expires_at ? new Date(data.expires_at) < new Date() : true;

    return Response.json({ 
      connected,
      expired: connected && expired,
      folderId: data?.folder_id 
    });
  }

  // Handle OAuth callback
  const code = url.searchParams.get('code');
  
  if (!code) {
    return Response.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }

    const tokens = await tokenResponse.json();
    
    // Calculate expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Create OmniScribe folder in Drive
    const folderId = await createDriveFolder(tokens.access_token);

    // Save tokens
    await supabase
      .from('gdrive_tokens')
      .upsert({
        id: 1,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        folder_id: folderId,
        updated_at: new Date().toISOString()
      });

    // Redirect back to app
    return Response.redirect(new URL('/?gdrive=connected', request.url).origin + '/?gdrive=connected');
  } catch (error) {
    console.error('OAuth error:', error);
    return Response.redirect(new URL('/?gdrive=error', request.url).origin + '/?gdrive=error');
  }
}

export async function DELETE() {
  try {
    await supabase
      .from('gdrive_tokens')
      .delete()
      .eq('id', 1);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    return Response.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

async function createDriveFolder(accessToken: string): Promise<string> {
  // Check if folder already exists
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='OmniScribe' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  const searchResult = await searchResponse.json();
  
  if (searchResult.files?.length > 0) {
    return searchResult.files[0].id;
  }

  // Create new folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'OmniScribe',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  const folder = await createResponse.json();
  return folder.id;
}
