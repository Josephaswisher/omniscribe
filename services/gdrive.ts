export async function syncNoteToGDrive(noteId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/gdrive/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId })
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('GDrive sync error:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('GDrive sync error:', error);
    return false;
  }
}

export async function checkGDriveConnection(): Promise<boolean> {
  try {
    const response = await fetch('/api/gdrive/auth?action=status');
    const data = await response.json();
    return data.connected && !data.expired;
  } catch {
    return false;
  }
}

export async function getGDriveAuthUrl(): Promise<string | null> {
  try {
    const response = await fetch('/api/gdrive/auth?action=url');
    const { url } = await response.json();
    return url;
  } catch {
    return null;
  }
}

export async function disconnectGDrive(): Promise<boolean> {
  try {
    const response = await fetch('/api/gdrive/auth', { method: 'DELETE' });
    return response.ok;
  } catch {
    return false;
  }
}
