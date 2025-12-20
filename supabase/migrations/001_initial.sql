-- OmniScribe Database Schema

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  duration REAL NOT NULL,
  audio_url TEXT,
  transcript TEXT,
  parsed_summary TEXT,
  parser_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  gdrive_audio_id TEXT,
  gdrive_transcript_id TEXT
);

-- Parsers table
CREATE TABLE IF NOT EXISTS parsers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Google Drive tokens (single user)
CREATE TABLE IF NOT EXISTS gdrive_tokens (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  folder_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default parsers
INSERT INTO parsers (id, name, description, system_prompt, is_default) VALUES
  ('raw', 'Raw', 'No processing, just transcription.', '', true),
  ('diary', 'Journal', 'Converts rambling thoughts into a neat diary entry.', 'You are an introspective journal editor. Take the following transcript and turn it into a beautifully written first-person journal entry. Correct grammar and flow while keeping the original sentiment.', true),
  ('todo', 'To-Do', 'Extracts actionable tasks.', 'You are a task extractor. List all actionable tasks or to-do items from the transcript as a clean bulleted list. If no tasks are found, say "No tasks found."', true),
  ('meeting', 'Minutes', 'Summarizes meetings.', 'You are a professional scribe. Summarize the transcript into meeting minutes with sections for: Key Discussion Points, Decisions Made, and Action Items.', true)
ON CONFLICT (id) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_parser_id ON notes(parser_id);

-- Enable Row Level Security (optional for single user, but good practice)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdrive_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for service role (API access)
CREATE POLICY "Service role full access notes" ON notes FOR ALL USING (true);
CREATE POLICY "Service role full access parsers" ON parsers FOR ALL USING (true);
CREATE POLICY "Service role full access gdrive" ON gdrive_tokens FOR ALL USING (true);

-- Storage bucket for audio files (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', false);
