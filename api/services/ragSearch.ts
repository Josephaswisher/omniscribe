import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface SearchResult {
  id: string;
  title: string | null;
  transcript: string | null;
  parsed_summary: string | null;
  created_at: string;
  word_count: number | null;
  duration: number | null;
  detected_language?: string | null;
  language_code?: string | null;
  similarity?: number;
  relevanceScore?: number;
  matchType: 'semantic' | 'keyword';
}

export interface SearchOptions {
  topK?: number;
  threshold?: number;
  includeKeywordFallback?: boolean;
}

export class RAGSearchService {
  /**
   * Main search method - tries semantic first, falls back to keyword
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, threshold = 0.5, includeKeywordFallback = true } = options;

    // Try semantic search first
    let results = await this.semanticSearch(query, topK, threshold);

    // Fallback to keyword search if semantic returns no/few results
    if (includeKeywordFallback && results.length < 2) {
      console.log('[RAG] Semantic search returned few results, adding keyword fallback');
      const keywordResults = await this.keywordSearch(query, topK - results.length);

      // Merge results, avoiding duplicates
      const existingIds = new Set(results.map(r => r.id));
      for (const kr of keywordResults) {
        if (!existingIds.has(kr.id)) {
          results.push(kr);
        }
      }
    }

    // Sort by relevance score
    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    return results.slice(0, topK);
  }

  /**
   * Semantic search using Gemini embeddings + pgvector
   */
  async semanticSearch(
    query: string,
    topK: number = 5,
    threshold: number = 0.5
  ): Promise<SearchResult[]> {
    try {
      // Generate query embedding
      const embeddingResponse = await genai.models.embedContent({
        model: 'text-embedding-004',
        contents: query.trim(),
      });

      const queryEmbedding = embeddingResponse.embeddings?.[0]?.values;
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.error('[RAG] Failed to generate query embedding');
        return [];
      }

      // Search using pgvector RPC
      const { data, error } = await supabase.rpc('search_notes_by_embedding', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: threshold,
        match_count: topK
      });

      if (error) {
        console.error('[RAG] Semantic search error:', error);
        return [];
      }

      // Add relevance scoring and mark as semantic match
      return (data || []).map((note: any) => ({
        ...note,
        matchType: 'semantic' as const,
        relevanceScore: this.calculateRelevanceScore(note.similarity, 'semantic')
      }));
    } catch (error) {
      console.error('[RAG] Semantic search failed:', error);
      return [];
    }
  }

  /**
   * Keyword-based full-text search fallback
   */
  async keywordSearch(
    query: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    try {
      // Split query into keywords
      const keywords = query.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);

      if (keywords.length === 0) return [];

      // Build ILIKE conditions for each keyword
      let dbQuery = supabase
        .from('notes')
        .select('id, title, transcript, parsed_summary, created_at, word_count, duration, detected_language, language_code')
        .eq('status', 'completed');

      // Search in title, transcript, and parsed_summary
      const searchPattern = keywords.map(k => `%${k}%`).join('%');

      const { data, error } = await dbQuery
        .or(`title.ilike.%${keywords[0]}%,transcript.ilike.%${keywords[0]}%,parsed_summary.ilike.%${keywords[0]}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[RAG] Keyword search error:', error);
        return [];
      }

      // Score results based on keyword matches
      return (data || []).map((note: any) => {
        const matchCount = this.countKeywordMatches(note, keywords);
        return {
          ...note,
          matchType: 'keyword' as const,
          similarity: matchCount / keywords.length,
          relevanceScore: this.calculateRelevanceScore(matchCount / keywords.length, 'keyword')
        };
      });
    } catch (error) {
      console.error('[RAG] Keyword search failed:', error);
      return [];
    }
  }

  /**
   * Count how many keywords appear in a note
   */
  private countKeywordMatches(note: any, keywords: string[]): number {
    const content = [
      note.title || '',
      note.transcript || '',
      note.parsed_summary || ''
    ].join(' ').toLowerCase();

    return keywords.filter(k => content.includes(k)).length;
  }

  /**
   * Calculate normalized relevance score (0-100)
   */
  private calculateRelevanceScore(similarity: number, matchType: 'semantic' | 'keyword'): number {
    // Semantic matches get a boost since they capture meaning
    const typeBoost = matchType === 'semantic' ? 1.2 : 1.0;
    return Math.min(100, Math.round(similarity * 100 * typeBoost));
  }

  /**
   * Format search results as context for Claude
   */
  formatContextForClaude(results: SearchResult[], query: string): string {
    if (results.length === 0) {
      return `No notes found matching the query "${query}".`;
    }

    const formattedNotes = results.map((note, index) => {
      const relevance = note.relevanceScore || 0;
      const matchType = note.matchType === 'semantic' ? '🔍 Semantic' : '🔤 Keyword';
      const date = new Date(note.created_at).toLocaleDateString();

      // Truncate content for context window efficiency
      const content = note.parsed_summary || note.transcript || '';
      const truncatedContent = content.length > 500
        ? content.substring(0, 500) + '...'
        : content;

      return `
### Note ${index + 1}: ${note.title || 'Untitled'}
- **ID**: ${note.id}
- **Date**: ${date}
- **Relevance**: ${relevance}% (${matchType})
- **Words**: ${note.word_count || 0}

**Content**:
${truncatedContent}
`.trim();
    }).join('\n\n---\n\n');

    return `Based on the query "${query}", here are the ${results.length} most relevant notes:

${formattedNotes}

---
Use this context to answer the user's question. Cite specific notes by their title when referencing information.`;
  }

  /**
   * Get a single note by ID with full content
   */
  async getNoteById(noteId: string): Promise<SearchResult | null> {
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, transcript, parsed_summary, created_at, word_count, duration, detected_language, language_code')
      .eq('id', noteId)
      .single();

    if (error || !data) {
      console.error('[RAG] Get note error:', error);
      return null;
    }

    return {
      ...data,
      matchType: 'semantic' as const,
      relevanceScore: 100
    };
  }
}

// Singleton instance
export const ragSearchService = new RAGSearchService();
