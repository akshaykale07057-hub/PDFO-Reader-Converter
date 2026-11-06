import { useState, useEffect } from 'react';

/**
 * Synchronous check for navigator online status.
 * Returns true if the browser/device indicates network connectivity, false otherwise.
 */
export const isOnlineSync = (): boolean => {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
};

/**
 * Asynchronous check that tests actual internet connectivity.
 * Verifies navigator.onLine and probes a lightweight endpoint.
 */
export const checkIsOnline = async (): Promise<boolean> => {
  if (!isOnlineSync()) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    // Google 204 endpoint resolves immediately with no payload if online
    await fetch(`https://www.google.com/generate_204?_=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch {
    // If navigator has turned false, return false
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }

    // Secondary fallback probe in case google is blocked
    try {
      const fallbackController = new AbortController();
      const fbTimeout = setTimeout(() => fallbackController.abort(), 1500);
      await fetch(`https://cloudflare.com/cdn-cgi/trace?_=${Date.now()}`, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: fallbackController.signal,
      });
      clearTimeout(fbTimeout);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Global event dispatcher to open the Offline Alert Modal from anywhere in the app.
 */
export const triggerOfflineAlert = (customMessage?: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:show-offline-alert', {
        detail: { message: customMessage },
      })
    );
  }
};

/**
 * React hook to observe online/offline status with real-time updates.
 */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => isOnlineSync());

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setOnline(isOnlineSync());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
