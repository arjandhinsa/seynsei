import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uk.co.seyn.seynsei',
  appName: 'Seynsei',
  webDir: 'dist',
  // Serve the bundled web app over https:// on Android so cookies,
  // secure contexts, and the PWA service worker behave consistently.
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0e1820',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK', // light text on the app's dark background
      backgroundColor: '#0e1820',
    },
  },
}

export default config
