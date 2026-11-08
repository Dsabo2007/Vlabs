import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.virtuallab.electronics',
  appName: 'Virtual Electronics Lab',
  webDir: 'dist',
  backgroundColor: '#0b1220',
  android: {
    backgroundColor: '#0b1220',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
