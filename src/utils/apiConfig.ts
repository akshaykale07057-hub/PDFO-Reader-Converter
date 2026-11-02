/**
 * Central API Configuration
 * Resolves the backend base URL for web and native mobile (Capacitor) runtimes.
 */
export const getApiBaseUrl = (): string => {
  // 1. Environment variable if set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  // 2. If running on the web, use current origin unless localhost
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (
      origin &&
      !origin.includes('localhost') &&
      !origin.includes('127.0.0.1') &&
      !origin.includes('capacitor://') &&
      origin.startsWith('http')
    ) {
      return origin.replace(/\/+$/, '');
    }
  }

  // 3. Default production Render server
  return 'https://pdfo-reader-converter.onrender.com';
};
