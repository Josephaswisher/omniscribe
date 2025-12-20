import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const config = {
  runtime: 'edge'
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('parsers')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return Response.json({ parsers: data });
  } catch (error) {
    console.error('GET /api/parsers error:', error);
    return Response.json({ error: 'Failed to fetch parsers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, system_prompt } = body;

    if (!id || !name || !system_prompt) {
      return Response.json(
        { error: 'id, name, and system_prompt are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('parsers')
      .insert({
        id,
        name,
        description: description || '',
        system_prompt,
        is_default: false
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return Response.json({ error: 'Parser ID already exists' }, { status: 409 });
      }
      throw error;
    }

    return Response.json({ parser: data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/parsers error:', error);
    return Response.json({ error: 'Failed to create parser' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Parser ID required' }, { status: 400 });
    }

    // Don't allow deleting default parsers
    const { data: parser } = await supabase
      .from('parsers')
      .select('is_default')
      .eq('id', id)
      .single();

    if (parser?.is_default) {
      return Response.json({ error: 'Cannot delete default parsers' }, { status: 403 });
    }

    const { error } = await supabase
      .from('parsers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/parsers error:', error);
    return Response.json({ error: 'Failed to delete parser' }, { status: 500 });
  }
}
