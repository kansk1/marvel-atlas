'use strict';

(() => {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.isVersionAtLeast?.('6.2')) return;

  function protectFromAccidentalClose() {
    if (webApp.isVersionAtLeast('7.7')) webApp.disableVerticalSwipes();
    webApp.enableClosingConfirmation();
  }

  protectFromAccidentalClose();
  if (webApp.isVersionAtLeast('8.0')) webApp.onEvent('activated', protectFromAccidentalClose);
  window.addEventListener('pageshow', event => {
    if (event.persisted) protectFromAccidentalClose();
  });
})();
