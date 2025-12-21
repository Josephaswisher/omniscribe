import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Tool definitions for Claude Agent SDK
export const toolDefinitions = [
  {
    name: 'get_notes',
    description: 'Get a list of notes with optional date filters. Returns note metadata including id, title, created_at, word_count, and parser_id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fromDate: { type: 'string', description: 'Start date filter (ISO format, e.g., 2024-01-01)' },
        toDate: { type: 'string', description: 'End date filter (ISO format)' },
        limit: { type: 'number', description: 'Maximum number of notes to return (default: 20)' }
      }
    }
  },
  {
    name: 'get_note',
    description: 'Get the full content of a specific note by its ID, including transcript and parsed summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        noteId: { type: 'string', description: 'The UUID of the note to retrieve' }
      },
      required: ['noteId']
    }
  },
  {
    name: 'search_notes',
    description: 'Semantic search across all notes using AI embeddings. Returns notes most relevant to the query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'The search query (natural language)' },
        topK: { type: 'number', description: 'Number of results to return (default: 5)' }
      },
      required: ['query']
    }
  },
  {
    name: 'list_actions',
    description: 'List action items and to-dos extracted from parsed notes. Can filter by status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { 
          type: 'string', 
          enum: ['pending', 'completed', 'all'],
          description: 'Filter by action status (default: all)' 
        }
      }
    }
  },
  {
    name: 'get_stats',
    description: 'Get analytics and statistics about the user\'s notes collection.',
    input_schema: {
      type: 'object' as const,
      properties: {}
    }
  }
];

// Tool handlers
export const toolHandlers: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
  async get_notes({ fromDate, toDate, limit = 20 }: Record<string, unknown>) {
    let query = supabase
      .from('notes')
      .select('id, title, created_at, word_count, parser_id, duration, status')
      .eq('status', 'completed');
    
    if (fromDate && typeof fromDate === 'string') {
      query = query.gte('created_at', fromDate);
    }
    if (toDate && typeof toDate === 'string') {
      query = query.lte('created_at', toDate);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(Number(limit));
    
    if (error) throw new Error(`Failed to fetch notes: ${error.message}`);
    return data || [];
  },

  async get_note({ noteId }: Record<string, unknown>) {
    if (!noteId || typeof noteId !== 'string') {
      throw new Error('noteId is required');
    }
    
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, transcript, parsed_summary, created_at, duration, word_count, parser_id')
      .eq('id', noteId)
      .single();
    
    if (error) throw new Error(`Failed to fetch note: ${error.message}`);
    return data;
  },

  async search_notes({ query, topK = 5 }: Record<string, unknown>) {
    if (!query || typeof query !== 'string') {
      throw new Error('query is required');
    }

    // Generate query embedding with Gemini
    const embeddingResponse = await genai.models.embedContent({
      model: 'text-embedding-004',
      contents: query.trim(),
    });

    const queryEmbedding = embeddingResponse.embeddings?.[0]?.values;
    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    // Search using pgvector
    const { data, error } = await supabase.rpc('search_notes_by_embedding', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: 0.5,
      match_count: Number(topK)
    });

    if (error) throw new Error(`Search failed: ${error.message}`);
    return data || [];
  },

  async list_actions({ status = 'all' }: Record<string, unknown>) {
    // Get all notes with parsed summaries
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, title, parsed_summary, created_at')
      .not('parsed_summary', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch notes: ${error.message}`);

    // Extract action items from parsed summaries
    const actions: Array<{
      noteId: string;
      noteTitle: string;
      action: string;
      status: string;
      createdAt: string;
    }> = [];

    for (const note of notes || []) {
      if (!note.parsed_summary) continue;
      
      // Look for action items in common formats
      const actionPatterns = [
        /(?:^|\n)\s*[-*]\s*\[([x ])\]\s*(.+)/gim,  // Checkbox format
        /(?:^|\n)\s*(?:TODO|ACTION|TASK):\s*(.+)/gim,  // TODO: format
        /(?:^|\n)\s*[-*]\s*(?:Follow up|Schedule|Call|Email|Review|Complete|Send)(?:\s*:?\s*)(.+)/gim  // Action verbs
      ];

      for (const pattern of actionPatterns) {
        let match;
        while ((match = pattern.exec(note.parsed_summary)) !== null) {
          const isCompleted = match[1]?.toLowerCase() === 'x';
          const actionText = match[2] || match[1];
          
          const actionStatus = isCompleted ? 'completed' : 'pending';
          
          if (status === 'all' || status === actionStatus) {
            actions.push({
              noteId: note.id,
              noteTitle: note.title || 'Untitled',
              action: actionText.trim(),
              status: actionStatus,
              createdAt: note.created_at
            });
          }
        }
      }
    }

    return actions;
  },

  async get_stats() {
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, word_count, duration, created_at, parser_id')
      .eq('status', 'completed');

    if (error) throw new Error(`Failed to fetch stats: ${error.message}`);

    const totalNotes = notes?.length || 0;
    const totalWords = notes?.reduce((sum, n) => sum + (n.word_count || 0), 0) || 0;
    const totalDuration = notes?.reduce((sum, n) => sum + (n.duration || 0), 0) || 0;

    // Notes this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const notesThisWeek = notes?.filter(n => new Date(n.created_at) > oneWeekAgo).length || 0;

    // Parser breakdown
    const parserCounts: Record<string, number> = {};
    for (const note of notes || []) {
      parserCounts[note.parser_id] = (parserCounts[note.parser_id] || 0) + 1;
    }

    return {
      totalNotes,
      totalWords,
      totalDurationMinutes: Math.round(totalDuration / 60),
      notesThisWeek,
      avgWordsPerNote: totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0,
      parserBreakdown: parserCounts
    };
  }
};

// Execute a tool by name
export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(input);
}
