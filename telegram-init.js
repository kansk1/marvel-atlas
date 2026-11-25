'use strict';

(() => {
  const webApp = window.Telegram?.WebApp;
  if (!webApp || webApp.platform === 'unknown') return;

  document.documentElement.classList.add('telegram-miniapp');

  // Prevent a held poster or link from starting a native drag out of the WebView.
  document.addEventListener('dragstart', event => {
    if (event.target.closest('a, img')) event.preventDefault();
  }, { capture: true });

  function protectFromAccidentalClose() {
    if (webApp.isVersionAtLeast('7.7')) webApp.disableVerticalSwipes();
    if (webApp.isVersionAtLeast('6.2')) webApp.enableClosingConfirmation();
  }

  protectFromAccidentalClose();
  document.addEventListener('DOMContentLoaded', () => {
    webApp.ready();
    protectFromAccidentalClose();
    if (['ios', 'android', 'android_x'].includes(webApp.platform)) webApp.expand();
  }, { once: true });
  if (webApp.isVersionAtLeast('8.0')) webApp.onEvent('activated', protectFromAccidentalClose);
  window.addEventListener('pageshow', event => {
    if (event.persisted) protectFromAccidentalClose();
  });
})();
