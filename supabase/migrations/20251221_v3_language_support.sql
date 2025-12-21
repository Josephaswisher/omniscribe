-- V3.0 Language Detection Support
-- Add language columns to notes table

alter table notes add column if not exists detected_language text;
alter table notes add column if not exists language_code varchar(10);

-- Index for language filtering
create index if not exists notes_language_idx on notes(language_code);

-- Update search function to include language fields
create or replace function search_notes_by_embedding(
  query_embedding vector(768),
  match_threshold float default 0.3,
  match_count int default 10,
  p_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  transcript text,
  parsed_summary text,
  parser_id text,
  duration integer,
  status text,
  word_count integer,
  detected_language text,
  language_code varchar(10),
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    n.id,
    n.user_id,
    n.title,
    n.transcript,
    n.parsed_summary,
    n.parser_id,
    n.duration,
    n.status,
    n.word_count,
    n.detected_language,
    n.language_code,
    n.created_at,
    n.updated_at,
    1 - (n.embedding <=> query_embedding) as similarity
  from notes n
  where
    n.embedding is not null
    and 1 - (n.embedding <=> query_embedding) > match_threshold
    and (p_user_id is null or n.user_id = p_user_id)
  order by n.embedding <=> query_embedding
  limit match_count;
end;
$$;
