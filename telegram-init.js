'use strict';

(() => {
  const webApp = window.Telegram?.WebApp;
  if (typeof webApp?.disableVerticalSwipes === 'function' && webApp.isVersionAtLeast?.('7.7')) {
    webApp.disableVerticalSwipes();
  }
})();
