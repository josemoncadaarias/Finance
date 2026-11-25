import { Capacitor } from '@capacitor/core';
import { capabilitiesOf, type Capabilities } from './capabilities';

export type { Capabilities, Platform } from './capabilities';

/**
 * What THIS device can do, read once when the app starts (the platform never
 * changes while it runs). Ask it - `DEVICE.readsImages`, `DEVICE.native` -
 * instead of `Capacitor.getPlatform()` or `Capacitor.isNativePlatform()`.
 */
export const DEVICE: Capabilities = capabilitiesOf(Capacitor.getPlatform());
