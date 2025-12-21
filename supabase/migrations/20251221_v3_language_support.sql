-- OmniScribe V3.0 Migration: Multi-Language Support
-- Adds automatic language detection columns to notes table

-- Add language columns to notes table
alter table notes add column if not exists detected_language text;
alter table notes add column if not exists language_code varchar(10);

-- Add index for language filtering
create index if not exists notes_language_idx on notes(language_code);

-- Comment for documentation
comment on column notes.detected_language is 'Full language name detected from audio (e.g., English, Spanish)';
comment on column notes.language_code is 'ISO 639-1 language code (e.g., en, es, fr, de)';

-- Update search function to include language fields in results
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
  word_count integer,
  duration float,
  detected_language text,
  language_code varchar(10),
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
    n.word_count,
    n.duration,
    n.detected_language,
    n.language_code,
    1 - (n.embedding <=> query_embedding) as similarity
  from notes n
  where n.embedding is not null
    and 1 - (n.embedding <=> query_embedding) > match_threshold
  order by n.embedding <=> query_embedding
  limit match_count;
$$;

-- Grant execute permission
grant execute on function search_notes_by_embedding to anon, authenticated;
