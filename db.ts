
import { VoiceNote, Parser } from './types';

const DB_NAME = 'QuickVoiceDB';
const DB_VERSION = 1;

// Check if IndexedDB is available
function isIndexedDBAvailable(): boolean {
  try {
    if (typeof indexedDB === 'undefined') return false;
    // Test actual availability (can be blocked in private mode)
    indexedDB.open('__test__').onsuccess = function() {
      indexedDB.deleteDatabase('__test__');
    };
    return true;
  } catch {
    return false;
  }
}

export class QuickVoiceDB {
  private db: IDBDatabase | null = null;
  private isAvailable: boolean = true;
  // In-memory fallback for when IndexedDB is unavailable
  private memoryNotes: Map<string, VoiceNote> = new Map();
  private memoryParsers: Map<string, Parser> = new Map();

  async init(): Promise<void> {
    if (!isIndexedDBAvailable()) {
      console.warn('IndexedDB not available. Using in-memory fallback.');
      this.isAvailable = false;
      return;
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('parsers')) {
          db.createObjectStore('parsers', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => reject(event.target.error);
    });
  }

  async saveNote(note: VoiceNote): Promise<void> {
    if (!this.isAvailable) {
      this.memoryNotes.set(note.id, note);
      return;
    }
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllNotes(): Promise<VoiceNote[]> {
    if (!this.isAvailable) {
      return Array.from(this.memoryNotes.values()).sort((a, b) => b.createdAt - a.createdAt);
    }
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.sort((a: VoiceNote, b: VoiceNote) => b.createdAt - a.createdAt));
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.isAvailable) {
      this.memoryNotes.delete(id);
      return;
    }
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveParser(parser: Parser): Promise<void> {
    if (!this.isAvailable) {
      this.memoryParsers.set(parser.id, parser);
      return;
    }
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['parsers'], 'readwrite');
      const store = transaction.objectStore('parsers');
      const request = store.put(parser);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getParsers(): Promise<Parser[]> {
    if (!this.isAvailable) {
      return Array.from(this.memoryParsers.values());
    }
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['parsers'], 'readonly');
      const store = transaction.objectStore('parsers');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new QuickVoiceDB();
