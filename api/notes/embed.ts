import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const config = {
  runtime: 'nodejs',
  maxDuration: 30
};

export async function POST(request: Request) {
  try {
    const { noteId } = await request.json();

    if (!noteId) {
      return Response.json({ error: 'noteId is required' }, { status: 400 });
    }

    // Get note transcript
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('transcript')
      .eq('id', noteId)
      .single();

    if (fetchError || !note) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!note.transcript || note.transcript.length < 10) {
      return Response.json({ error: 'No transcript to embed' }, { status: 400 });
    }

    // Generate embedding with Gemini text-embedding-004
    const embeddingResponse = await genai.models.embedContent({
      model: 'text-embedding-004',
      contents: note.transcript,
    });

    const embedding = embeddingResponse.embeddings?.[0]?.values;

    if (!embedding || embedding.length === 0) {
      return Response.json({ error: 'Failed to generate embedding' }, { status: 500 });
    }

    // Store embedding in Supabase (pgvector format)
    const { error: updateError } = await supabase
      .from('notes')
      .update({ embedding: `[${embedding.join(',')}]` })
      .eq('id', noteId);

    if (updateError) {
      console.error('Update embedding error:', updateError);
      return Response.json({ error: 'Failed to save embedding' }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      noteId,
      embeddingDimension: embedding.length 
    });
  } catch (error) {
    console.error('POST /api/notes/embed error:', error);
    return Response.json({ error: 'Failed to generate embedding' }, { status: 500 });
  }
}

// Utility function to generate embedding for a query (used by search)
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddingResponse = await genai.models.embedContent({
    model: 'text-embedding-004',
    contents: text,
  });
  return embeddingResponse.embeddings?.[0]?.values || [];
}
