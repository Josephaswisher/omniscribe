import pg from 'pg';
const { Client } = pg;

// Supabase connection via transaction pooler (port 6543)
const connectionString = 'postgresql://postgres.vvvywosopdzgoeubpddg:OmniScribe2024!@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const migration = `
-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Note-Tags junction table
CREATE TABLE IF NOT EXISTS note_tags (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  timestamp_seconds REAL NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Actions table
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  icon TEXT DEFAULT 'file-text',
  category TEXT DEFAULT 'custom',
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add columns to notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notes_is_archived ON notes(is_archived);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_note_id ON actions(note_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_note_id ON bookmarks(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Service role full access folders" ON folders;
DROP POLICY IF EXISTS "Service role full access tags" ON tags;
DROP POLICY IF EXISTS "Service role full access note_tags" ON note_tags;
DROP POLICY IF EXISTS "Service role full access bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Service role full access actions" ON actions;
DROP POLICY IF EXISTS "Service role full access templates" ON templates;
DROP POLICY IF EXISTS "Service role full access analytics" ON analytics;

CREATE POLICY "Service role full access folders" ON folders FOR ALL USING (true);
CREATE POLICY "Service role full access tags" ON tags FOR ALL USING (true);
CREATE POLICY "Service role full access note_tags" ON note_tags FOR ALL USING (true);
CREATE POLICY "Service role full access bookmarks" ON bookmarks FOR ALL USING (true);
CREATE POLICY "Service role full access actions" ON actions FOR ALL USING (true);
CREATE POLICY "Service role full access templates" ON templates FOR ALL USING (true);
CREATE POLICY "Service role full access analytics" ON analytics FOR ALL USING (true);

-- Insert default data
INSERT INTO folders (name, color, icon) VALUES
  ('Personal', '#10b981', 'user'),
  ('Work', '#3b82f6', 'briefcase'),
  ('Ideas', '#f59e0b', 'lightbulb')
ON CONFLICT DO NOTHING;

INSERT INTO tags (name, color) VALUES
  ('important', '#ef4444'),
  ('follow-up', '#f59e0b'),
  ('meeting', '#3b82f6'),
  ('personal', '#10b981'),
  ('idea', '#8b5cf6')
ON CONFLICT (name) DO NOTHING;
`;

async function runMigration() {
  console.log('Connecting to Supabase Postgres...');
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected! Running migration...\n');
    
    await client.query(migration);
    
    console.log('✓ Migration completed successfully!');
    
    // Verify tables
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('folders', 'tags', 'note_tags', 'bookmarks', 'actions', 'templates', 'analytics')
    `);
    
    console.log('\nTables created:');
    rows.forEach(r => console.log(`  ✓ ${r.table_name}`));
    
  } catch (err) {
    console.error('Migration error:', err.message);
    
    if (err.message.includes('password authentication failed')) {
      console.log('\nNote: You need to set the correct database password.');
      console.log('Go to Supabase Dashboard > Settings > Database > Connection string');
    }
  } finally {
    await client.end();
  }
}

runMigration();
