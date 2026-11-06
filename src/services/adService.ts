import { AdMob, BannerAdPosition, BannerAdSize, InterstitialAdPluginEvents, BannerAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { isOnlineSync } from '../utils/networkUtils';

class AdService {
  private isInitialized = false;
  private isProUser = false;
  private isInterstitialReady = false;
  private isPreloading = false;
  private lastAdShownTime = 0;
  private preloadRetryTimeout: any = null;
  private preloadRetryDelayMs = 5000;
  private readonly MAX_RETRY_DELAY_MS = 60000;
  // 3-minute cooldown (180,000 ms) to avoid spamming ads when switching apps or using camera
  private readonly RESUME_AD_COOLDOWN_MS = 3 * 60 * 1000;

  // Production Ad Unit IDs provided by Google AdMob
  private adIds = {
    banner: 'ca-app-pub-9248966687813984/8041522919',
    interstitial: 'ca-app-pub-9248966687813984/3599715027',
  };

  constructor() {
    // When network reconnects, immediately trigger background preloading and banner refresh
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Network back online: preloading interstitial and restoring banner');
        if (!this.isInterstitialReady && !this.isProUser) {
          this.preloadRetryDelayMs = 5000;
          this.preloadInterstitial();
        }
        if (!this.isProUser) {
          this.showBanner();
        }
      });
    }
  }

  /**
   * Sets the Pro user state. If Pro, hides any active banner and disables ads.
   */
  setPro(isPro: boolean) {
    this.isProUser = isPro;
    if (isPro) {
      this.hideBanner();
      if (this.preloadRetryTimeout) {
        clearTimeout(this.preloadRetryTimeout);
        this.preloadRetryTimeout = null;
      }
    }
  }

  /**
   * Schedules a retry to preload interstitial ad when low network causes a failure.
   */
  private schedulePreloadRetry() {
    if (this.isProUser || this.isInterstitialReady || !isOnlineSync()) return;

    if (this.preloadRetryTimeout) {
      clearTimeout(this.preloadRetryTimeout);
    }

    console.log(`[AdService] Interstitial preload will retry in ${this.preloadRetryDelayMs / 1000}s`);
    this.preloadRetryTimeout = setTimeout(() => {
      this.preloadRetryTimeout = null;
      if (!this.isInterstitialReady && !this.isProUser && isOnlineSync()) {
        this.preloadInterstitial();
      }
    }, this.preloadRetryDelayMs);

    // Exponential backoff up to 60s
    this.preloadRetryDelayMs = Math.min(this.preloadRetryDelayMs * 1.5, this.MAX_RETRY_DELAY_MS);
  }

  /**
   * Initializes the AdMob SDK and starts preloading ads.
   */
  async initialize() {
    if (!Capacitor.isNativePlatform() || this.isInitialized) return;
    try {
      await AdMob.initialize({});
      this.isInitialized = true;
      console.log('AdMob initialized successfully');

      // Set up global event listeners for Interstitial Ads
      AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        console.log('[AdService] Interstitial dismissed. Preloading next ad in background.');
        this.isInterstitialReady = false;
        this.isPreloading = false;
        this.preloadInterstitial();
      });

      AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
        console.warn('[AdService] Interstitial FailedToLoad (low network/no-fill):', err);
        this.isInterstitialReady = false;
        this.isPreloading = false;
        this.schedulePreloadRetry();
      });

      AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
        console.log('[AdService] Interstitial ad Loaded into local cache and ready');
        this.isInterstitialReady = true;
        this.isPreloading = false;
        this.preloadRetryDelayMs = 5000;
        if (this.preloadRetryTimeout) {
          clearTimeout(this.preloadRetryTimeout);
          this.preloadRetryTimeout = null;
        }
      });

      // Set up size change listener for Banner Ads to adjust bottom layout spacing
      AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info: { height: number }) => {
        if (info && typeof info.height === 'number') {
          console.log('Banner size changed, height:', info.height);
          const event = new CustomEvent('admob-banner-height-changed', { detail: info.height });
          window.dispatchEvent(event);
        }
      });

      // Initial pre-load in background
      this.preloadInterstitial();
    } catch (e) {
      console.error('AdMob initialization failed:', e);
    }
  }

  /**
   * Preloads an interstitial ad into disk/memory cache in the background.
   */
  async preloadInterstitial() {
    if (!this.isInitialized || this.isProUser || this.isPreloading || this.isInterstitialReady) return;
    if (!isOnlineSync()) return;

    try {
      this.isPreloading = true;
      await AdMob.prepareInterstitial({
        adId: this.adIds.interstitial,
        isTesting: false,
      });
    } catch (e) {
      this.isPreloading = false;
      this.isInterstitialReady = false;
      console.warn('[AdService] Preload interstitial error:', e);
      this.schedulePreloadRetry();
    }
  }

  /**
   * Shows a banner ad at the bottom of the screen.
   */
  async showBanner() {
    if (!this.isInitialized || this.isProUser || !isOnlineSync()) return;
    try {
      await AdMob.showBanner({
        adId: this.adIds.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false
      });
      console.log('Banner ad shown');
    } catch (e) {
      console.error('Show banner failed:', e);
    }
  }

  /**
   * Hides the active banner ad.
   */
  async hideBanner() {
    if (!this.isInitialized) return;
    try {
      await AdMob.removeBanner();
      console.log('Banner ad removed');
      // Dispatch 0 height so layouts adjust back to default bottom margins
      const event = new CustomEvent('admob-banner-height-changed', { detail: 0 });
      window.dispatchEvent(event);
    } catch (e) {
      console.error('Hide banner failed:', e);
    }
  }

  /**
   * Loads an interstitial ad with a timeout (for weak networks).
   */
  private prepareWithTimeout(timeoutMs = 20000, onProgress?: (msg: string) => void): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let loadedHandle: any = null;
      let failedHandle: any = null;

      const cleanup = () => {
        clearTimeout(timer);
        if (loadedHandle?.remove) loadedHandle.remove();
        if (failedHandle?.remove) failedHandle.remove();
        this.isPreloading = false;
      };

      const finish = (result: boolean) => {
        if (!isDone) {
          isDone = true;
          cleanup();
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        console.warn('[AdService] prepareWithTimeout timed out after', timeoutMs, 'ms');
        finish(false);
      }, timeoutMs);

      try {
        loadedHandle = await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
          console.log('[AdService] Interstitial loaded via prepareWithTimeout');
          this.isInterstitialReady = true;
          finish(true);
        });

        failedHandle = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
          console.warn('[AdService] Interstitial FailedToLoad via prepareWithTimeout:', err);
          this.isInterstitialReady = false;
          finish(false);
        });

        this.isPreloading = true;
        onProgress?.('downloading');
        await AdMob.prepareInterstitial({
          adId: this.adIds.interstitial,
          isTesting: false,
        });
      } catch (e) {
        console.warn('[AdService] prepareWithTimeout exception:', e);
        finish(false);
      }
    });
  }

  /**
   * Shows a preloaded interstitial ad and waits for user dismissal.
   */
  private showWithDismissPromise(timeoutMs = 60000): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let dismissedHandle: any = null;
      let failedHandle: any = null;

      const cleanup = () => {
        clearTimeout(timer);
        if (dismissedHandle?.remove) dismissedHandle.remove();
        if (failedHandle?.remove) failedHandle.remove();
      };

      const finish = (result: boolean) => {
        if (!isDone) {
          isDone = true;
          cleanup();
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        console.warn('[AdService] showWithDismissPromise timed out');
        finish(true); // Don't permanently block user if dismiss event was swallowed
      }, timeoutMs);

      try {
        dismissedHandle = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          console.log('[AdService] Interstitial dismissed by user');
          this.isInterstitialReady = false;
          this.preloadInterstitial(); // preload next ad in background
          finish(true);
        });

        failedHandle = await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (err) => {
          console.warn('[AdService] Interstitial FailedToShow:', err);
          this.isInterstitialReady = false;
          this.preloadInterstitial();
          finish(false);
        });

        this.lastAdShownTime = Date.now();
        this.isInterstitialReady = false;
        await AdMob.showInterstitial();
      } catch (e) {
        console.warn('[AdService] showWithDismissPromise exception:', e);
        this.isInterstitialReady = false;
        finish(false);
      }
    });
  }

  /**
   * Loads an ad over weak network if needed and displays it.
   * Returns 'success' if ad was displayed and closed, or 'failed' if network failed.
   */
  async loadAndShowInterstitial(onProgress?: (step: string) => void): Promise<'success' | 'failed'> {
    if (!Capacitor.isNativePlatform() || !this.isInitialized) {
      // In web browser testing: simulate short 1.2s buffer
      onProgress?.('downloading');
      await new Promise(r => setTimeout(r, 1200));
      return 'success';
    }

    try {
      // Step 1: If ad is not pre-cached, buffer it now (waiting up to 25s for weak network)
      if (!this.isInterstitialReady) {
        onProgress?.('connecting');
        const loaded = await this.prepareWithTimeout(25000, onProgress);
        if (!loaded) {
          return 'failed';
        }
      }

      // Step 2: Show the real AdMob ad and wait for user to dismiss
      onProgress?.('showing');
      const shown = await this.showWithDismissPromise();
      return shown ? 'success' : 'failed';
    } catch (e) {
      console.warn('[AdService] loadAndShowInterstitial failed:', e);
      return 'failed';
    }
  }

  /**
   * Shows an interstitial ad and runs callback when dismissed.
   * - If an ad is pre-cached: shows instantly.
   * - If an ad is NOT cached yet (weak network): opens the Ad Loading modal so the user
   *   waits for the ad to load before opening the document. Without seeing the ad,
   *   the document will NOT open!
   */
  async showInterstitial(onComplete: () => void, onCancel?: () => void) {
    if (this.isProUser) {
      onComplete();
      return;
    }

    // Completely offline: bypass ads so user can view offline files
    if (!isOnlineSync()) {
      onComplete();
      return;
    }

    if (Capacitor.isNativePlatform() && this.isInitialized) {
      // 1. If ad is already cached in memory, show immediately
      if (this.isInterstitialReady) {
        const success = await this.showWithDismissPromise();
        if (success) {
          onComplete();
          return;
        }
        // If showing failed, fall through to load a fresh one
      }

      // 2. Ad is not ready (due to weak network).
      // Open the Loading Ad modal to wait for the ad to load before opening document.
      const event = new CustomEvent('show-ad-loader', {
        detail: { onComplete, onCancel }
      });
      window.dispatchEvent(event);
    } else {
      // On desktop / web development
      onComplete();
    }
  }

  /**
   * Shows an App Open ad on app resume with a 3-minute frequency cap.
   * Only shows if ad was already cached to prevent freezing on weak networks.
   */
  async showAppOpenAd() {
    if (!this.isInitialized || this.isProUser || !isOnlineSync()) return;

    const now = Date.now();
    if (now - this.lastAdShownTime < this.RESUME_AD_COOLDOWN_MS) {
      return;
    }

    // Only show if pre-cached; never freeze the resume flow on slow networks
    if (!this.isInterstitialReady) {
      this.preloadInterstitial();
      return;
    }

    try {
      this.lastAdShownTime = now;
      this.isInterstitialReady = false;
      await AdMob.showInterstitial();
      console.log('App Open (Interstitial) Ad shown on resume');
    } catch (e) {
      console.warn('Failed to show App Open (Interstitial) ad:', e);
      this.preloadInterstitial();
    }
  }
}

export const adService = new AdService();
