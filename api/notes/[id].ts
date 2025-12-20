import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const config = {
  runtime: 'edge'
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Response.json({ error: 'Note ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    return Response.json({ note: data });
  } catch (error) {
    console.error('GET /api/notes/[id] error:', error);
    return Response.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Response.json({ error: 'Note ID required' }, { status: 400 });
    }

    // Delete audio from storage
    const extensions = ['mp4', 'webm', 'ogg', 'wav', 'mp3'];
    for (const ext of extensions) {
      await supabase.storage.from('audio').remove([`${id}.${ext}`]);
    }

    // Delete note from database
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/notes/[id] error:', error);
    return Response.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const body = await request.json();

    if (!id) {
      return Response.json({ error: 'Note ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notes')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({ note: data });
  } catch (error) {
    console.error('PATCH /api/notes/[id] error:', error);
    return Response.json({ error: 'Failed to update note' }, { status: 500 });
  }
}
