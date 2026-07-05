import { AdMob, BannerAdPosition, BannerAdSize, InterstitialAdPluginEvents, BannerAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

class AdService {
  private isInitialized = false;
  private isProUser = false;
  private isInterstitialReady = false;

  // Test Ad Unit IDs provided by Google AdMob for safety during development
  private adIds = {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  };

  /**
   * Sets the Pro user state. If Pro, hides any active banner and disables ads.
   */
  setPro(isPro: boolean) {
    this.isProUser = isPro;
    if (isPro) {
      this.hideBanner();
    }
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
        this.isInterstitialReady = false;
        this.preloadInterstitial();
      });
      AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
        this.isInterstitialReady = false;
      });
      AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
        this.isInterstitialReady = true;
      });

      // Set up size change listener for Banner Ads to adjust bottom layout spacing
      AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info: { height: number }) => {
        if (info && typeof info.height === 'number') {
          console.log('Banner size changed, height:', info.height);
          const event = new CustomEvent('admob-banner-height-changed', { detail: info.height });
          window.dispatchEvent(event);
        }
      });

      // Initial pre-load so ads are ready to show immediately
      this.preloadInterstitial();
    } catch (e) {
      console.error('AdMob initialization failed:', e);
    }
  }

  /**
   * Preloads an interstitial ad in the background.
   */
  async preloadInterstitial() {
    if (!this.isInitialized || this.isProUser) return;
    try {
      await AdMob.prepareInterstitial({
        adId: this.adIds.interstitial,
        isTesting: true,
      });
    } catch (e) {
      console.warn('Preload interstitial failed:', e);
    }
  }

  /**
   * Shows a banner ad at the bottom of the screen.
   */
  async showBanner() {
    if (!this.isInitialized || this.isProUser) return;
    try {
      await AdMob.showBanner({
        adId: this.adIds.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: true
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
   * Shows an interstitial ad and runs the callback when dismissed/failed.
   */
  async showInterstitial(onComplete: () => void) {
    if (this.isProUser) {
      onComplete();
      return;
    }

    if (Capacitor.isNativePlatform() && this.isInitialized) {
      try {
        // If not preloaded, attempt to preload first (fallback)
        if (!this.isInterstitialReady) {
          await AdMob.prepareInterstitial({
            adId: this.adIds.interstitial,
            isTesting: true
          });
        }

        // Add temporary listeners to catch this specific completion
        const dismissedListener = AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          dismissedListener.then(h => h.remove());
          onComplete();
        });

        const failedListener = AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => {
          failedListener.then(h => h.remove());
          onComplete();
        });

        await AdMob.showInterstitial();
      } catch (e) {
        console.warn('Failed to show native interstitial, proceeding to simulated ad:', e);
        const event = new CustomEvent('show-simulated-ad', { detail: { onComplete } });
        window.dispatchEvent(event);
      }
    } else {
      // Trigger simulated ad overlay on web/non-native platform
      const event = new CustomEvent('show-simulated-ad', { detail: { onComplete } });
      window.dispatchEvent(event);
    }
  }

  /**
   * Shows an App Open ad on app resume.
   * We fallback to full-screen Interstitial ad since App Open Ads are not supported by the plugin version.
   */
  async showAppOpenAd() {
    if (!this.isInitialized || this.isProUser) return;

    try {
      if (!this.isInterstitialReady) {
        await this.preloadInterstitial();
      }
      
      await AdMob.showInterstitial();
      console.log('App Open (Interstitial) Ad shown on resume');
    } catch (e) {
      console.warn('Failed to show App Open (Interstitial) ad:', e);
    }
  }
}

export const adService = new AdService();
