/** Small bridge to the phone: Android app (Capacitor) vs. iPhone/web app (PWA). */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Opened from the home-screen icon (not in a Safari tab). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** iPhone in a normal Safari tab: the app should be added to the home screen first. */
export function needsIOSInstall(): boolean {
  return !__PROTOTYPE__ && !isNative() && isIOS() && !isStandalone();
}

export function registerServiceWorker() {
  if (__PROTOTYPE__ || isNative() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:') return;
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* offline cache is a bonus; the app works without it */
  });
}

/** Android back button: close what is open, else go to Start, else leave the app. */
export async function initNativeBack(handle: () => boolean) {
  if (!isNative()) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    if (!handle()) void App.exitApp();
  });
}

/** Dark icons on the light theme, light icons on the dark one. */
export async function setSystemBars(dark: boolean) {
  if (!isNative()) return;
  const { SystemBars, SystemBarsStyle } = await import('@capacitor/core');
  await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
}

export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener');
}
