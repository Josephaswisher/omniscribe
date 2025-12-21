-- OmniScribe V3.0 Migration: Embeddings + Segments
-- Enable pgvector extension for semantic search

create extension if not exists vector;

-- Add embedding column to notes table (Gemini text-embedding-004 = 768 dimensions)
alter table notes add column if not exists embedding vector(768);

-- Create index for fast similarity search
create index if not exists notes_embedding_idx 
  on notes using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Note segments table for transcript-audio sync
create table if not exists note_segments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete cascade not null,
  start_ms integer not null,
  end_ms integer not null,
  text text not null,
  speaker_label text,
  confidence float,
  created_at timestamptz default now()
);

create index if not exists note_segments_note_id_idx on note_segments(note_id);
create index if not exists note_segments_timing_idx on note_segments(note_id, start_ms);

-- Semantic search function using cosine similarity
create or replace function search_notes_by_embedding(
  query_embedding vector(768),
  match_threshold float default 0.5,
  match_count int default 10
)
returns table (
  id uuid,
  title text,
  transcript text,
  parsed_summary text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select 
    n.id,
    n.title,
    n.transcript,
    n.parsed_summary,
    n.created_at,
    1 - (n.embedding <=> query_embedding) as similarity
  from notes n
  where n.embedding is not null
    and 1 - (n.embedding <=> query_embedding) > match_threshold
  order by n.embedding <=> query_embedding
  limit match_count;
$$;

-- Grant execute permission
grant execute on function search_notes_by_embedding to anon, authenticated;
