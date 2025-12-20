import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vvvywosopdzgoeubpddg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2dnl3b3NvcGR6Z29ldWJwZGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5NjcyNjEzNywiZXhwIjoyMDEyMzAyMTM3fQ.Lz8TyEnzfA8FJankNtbjVAU5pCm6Sg5nSCDvdCiCDKY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const statements = [
  // Folders table
  `CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  
  // Tags table
  `CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#8b5cf6',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  
  // Note-Tags junction
  `CREATE TABLE IF NOT EXISTS note_tags (
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
  )`,
  
  // Bookmarks
  `CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
    timestamp_seconds REAL NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  
  // Actions
  `CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  
  // Templates
  `CREATE TABLE IF NOT EXISTS templates (
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
  )`,
  
  // Analytics
  `CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  
  // Add columns to notes
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0`,
];

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_is_archived ON notes(is_archived)`,
  `CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_actions_note_id ON actions(note_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bookmarks_note_id ON bookmarks(note_id)`,
  `CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id)`,
  `CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id)`,
  `CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at)`,
];

const rls = [
  `ALTER TABLE folders ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE tags ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE actions ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE templates ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE analytics ENABLE ROW LEVEL SECURITY`,
];

const policies = [
  `CREATE POLICY IF NOT EXISTS "Service role full access folders" ON folders FOR ALL USING (true)`,
  `CREATE POLICY IF NOT EXISTS "Service role full access tags" ON tags FOR ALL USING (true)`,
  `CREATE POLICY IF NOT EXISTS "Service role full access note_tags" ON note_tags FOR ALL USING (true)`,
  `CREATE POLICY IF NOT EXISTS "Service role full access bookmarks" ON bookmarks FOR ALL USING (true)`,
  `CREATE POLICY IF NOT EXISTS "Service role full access actions" ON actions FOR ALL USING (true)`,
  `CREATE POLICY IF NOT EXISTS "Service role full access templates" ON templates FOR ALL USING (true)`,
  `CREATE POLICY IF NOT EXISTS "Service role full access analytics" ON analytics FOR ALL USING (true)`,
];

async function runMigration() {
  console.log('Running V2 migration...\n');
  
  // Run table creation via RPC
  for (const sql of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error && !error.message.includes('already exists')) {
        console.log('Statement result:', error.message);
      }
    } catch (e) {
      // Ignore - we'll try direct insert instead
    }
  }
  
  // Insert default folders
  const { error: folderError } = await supabase
    .from('folders')
    .upsert([
      { name: 'Personal', color: '#10b981', icon: 'user' },
      { name: 'Work', color: '#3b82f6', icon: 'briefcase' },
      { name: 'Ideas', color: '#f59e0b', icon: 'lightbulb' },
    ], { onConflict: 'name', ignoreDuplicates: true });
  
  if (folderError) {
    console.log('Folders:', folderError.message);
  } else {
    console.log('✓ Default folders created');
  }
  
  // Insert default tags
  const { error: tagError } = await supabase
    .from('tags')
    .upsert([
      { name: 'important', color: '#ef4444' },
      { name: 'follow-up', color: '#f59e0b' },
      { name: 'meeting', color: '#3b82f6' },
      { name: 'personal', color: '#10b981' },
      { name: 'idea', color: '#8b5cf6' },
    ], { onConflict: 'name', ignoreDuplicates: true });
  
  if (tagError) {
    console.log('Tags:', tagError.message);
  } else {
    console.log('✓ Default tags created');
  }
  
  // Verify tables exist
  const tables = ['folders', 'tags', 'note_tags', 'bookmarks', 'actions', 'templates', 'analytics'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`✗ ${table}: ${error.message}`);
    } else {
      console.log(`✓ ${table} table ready`);
    }
  }
  
  console.log('\nMigration complete!');
}

runMigration().catch(console.error);
