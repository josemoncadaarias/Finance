import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jadexlabs.finance',
  appName: 'Finance',
  webDir: 'www',
  plugins: {
    // The database is opened with 'no-encryption', but the plugin defaults to
    // encryption ON, and on start it then builds an Android Keystore master key
    // and EncryptedSharedPreferences for a secret this app never stores. On
    // some phones that throws (a keystore fault, or encrypted prefs restored by
    // Android's backup without their key), the plugin loads with no
    // implementation, and every call fails with "CapacitorSQLitePlugin: null":
    // a fresh install that cannot open its database. Off, nothing of it runs.
    CapacitorSQLite: {
      androidIsEncryption: false,
      iosIsEncryption: false,
    },
  },
};

export default config;
