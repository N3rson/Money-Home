import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.n3rson.moneyhome',
  appName: 'Money Home',
  webDir: 'dist',
  android: {
    backgroundColor: '#edebe5',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'native',
      style: 'DEFAULT',
    },
  },
};

export default config;
