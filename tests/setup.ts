import '@testing-library/dom';

// Remove IndexedDB to force in-memory fallback
Object.defineProperty(globalThis, 'indexedDB', {
  value: undefined,
  writable: true,
});
