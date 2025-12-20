export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('SW registered:', registration.scope);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                console.log('New version available');
              }
            });
          }
        });
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    });

    // Listen for sync messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_NOTES') {
        window.dispatchEvent(new CustomEvent('sw-sync-notes'));
      }
    });
  }
}

export function requestBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      return (registration as any).sync?.register('sync-notes');
    }).catch((err) => {
      console.error('Background sync registration failed:', err);
    });
  }
}
