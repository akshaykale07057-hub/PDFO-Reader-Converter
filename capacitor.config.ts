import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pdforeader.app',
  appName: 'PDFO Reader & Converter',
  webDir: 'dist',
  server: {
    url: 'https://pdfo-reader-converter.onrender.com',
    cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 150,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash_icon',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    Keyboard: {
      resizeOnFullScreen: true
    }
  }
};

export default config;

