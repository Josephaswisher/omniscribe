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
    const { query, topK = 5, threshold = 0.5 } = await request.json();

    if (!query || query.trim().length === 0) {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    // Generate query embedding
    const embeddingResponse = await genai.models.embedContent({
      model: 'text-embedding-004',
      contents: query.trim(),
    });

    const queryEmbedding = embeddingResponse.embeddings?.[0]?.values;

    if (!queryEmbedding || queryEmbedding.length === 0) {
      return Response.json({ error: 'Failed to generate query embedding' }, { status: 500 });
    }

    // Call the semantic search RPC function
    const { data: results, error: searchError } = await supabase
      .rpc('search_notes_by_embedding', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: threshold,
        match_count: topK
      });

    if (searchError) {
      console.error('Search error:', searchError);
      return Response.json({ error: 'Search failed' }, { status: 500 });
    }

    return Response.json({ 
      results: results || [],
      query,
      count: results?.length || 0
    });
  } catch (error) {
    console.error('POST /api/notes/search error:', error);
    return Response.json({ error: 'Failed to search notes' }, { status: 500 });
  }
}
