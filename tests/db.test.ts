import { describe, it, expect, beforeEach } from 'vitest';
import { QuickVoiceDB } from '../db';
import { VoiceNote } from '../types';

describe('QuickVoiceDB', () => {
  let db: QuickVoiceDB;

  beforeEach(() => {
    db = new QuickVoiceDB();
  });

  describe('in-memory fallback', () => {
    it('should save and retrieve notes when IndexedDB unavailable', async () => {
      await db.init();
      
      const testNote: VoiceNote = {
        id: 'test-1',
        createdAt: Date.now(),
        duration: 30,
        audioBlob: new Blob(['test'], { type: 'audio/mp4' }),
        parserId: 'raw',
        status: 'pending',
      };

      await db.saveNote(testNote);
      const notes = await db.getAllNotes();
      
      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes.find(n => n.id === 'test-1')).toBeDefined();
    });

    it('should delete notes', async () => {
      await db.init();
      
      const testNote: VoiceNote = {
        id: 'test-delete',
        createdAt: Date.now(),
        duration: 15,
        audioBlob: new Blob(['test'], { type: 'audio/mp4' }),
        parserId: 'raw',
        status: 'pending',
      };

      await db.saveNote(testNote);
      await db.deleteNote('test-delete');
      
      const notes = await db.getAllNotes();
      expect(notes.find(n => n.id === 'test-delete')).toBeUndefined();
    });
  });
});
