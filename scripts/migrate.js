#!/usr/bin/env node
/**
 * Database migration script for OmniScribe
 * Run with: node scripts/migrate.js
 */

const { Client } = require('pg');

// Extract connection details from Supabase URL
const SUPABASE_URL = 'https://vvvywosopdzgoeubpddg.supabase.co';
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Supabase database connection string format
const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD || 'YOUR_DB_PASSWORD'}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const migrations = [
  // Check if notes table exists and has correct schema
  `
  CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    duration FLOAT DEFAULT 0,
    audio_url TEXT,
    transcript TEXT,
    parsed_summary TEXT,
    parser_id TEXT DEFAULT 'raw',
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    gdrive_audio_id TEXT,
    gdrive_transcript_id TEXT,
    title TEXT,
    word_count INTEGER DEFAULT 0
  );
  `,
  
  // Add missing columns if table already exists
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS duration FLOAT DEFAULT 0;`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS audio_url TEXT;`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS transcript TEXT;`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS parsed_summary TEXT;`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS parser_id TEXT DEFAULT 'raw';`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS error_message TEXT;`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS gdrive_audio_id TEXT;`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS gdrive_transcript_id TEXT;`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT;`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;`,
  
  // Create index
  `CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);`,
  
  // Parsers table
  `
  CREATE TABLE IF NOT EXISTS parsers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL DEFAULT '',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  
  // GDrive tokens table
  `
  CREATE TABLE IF NOT EXISTS gdrive_tokens (
    id INTEGER PRIMARY KEY DEFAULT 1,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    folder_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  `
];

async function runMigrations() {
  console.log('Running migrations...');
  console.log('Connection string:', connectionString.replace(/:[^:@]+@/, ':****@'));
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i].trim();
      if (!sql) continue;
      
      try {
        await client.query(sql);
        console.log(`✓ Migration ${i + 1}/${migrations.length} completed`);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists')) {
          console.log(`✓ Migration ${i + 1}/${migrations.length} skipped (already exists)`);
        } else {
          console.error(`✗ Migration ${i + 1} failed:`, err.message);
        }
      }
    }
    
    console.log('\nMigrations complete!');
    
    // Verify tables
    const result = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'notes'
      ORDER BY ordinal_position
    `);
    
    console.log('\nNotes table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (err) {
    console.error('Connection error:', err.message);
    console.log('\nTo run this migration, you need the database password.');
    console.log('Get it from: Supabase Dashboard > Settings > Database > Connection string');
    console.log('\nThen run: SUPABASE_DB_PASSWORD=your_password node scripts/migrate.js');
  } finally {
    await client.end();
  }
}

runMigrations();
