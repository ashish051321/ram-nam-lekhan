import { initConsent, bindConsentUI } from './consent.js?v=20251101';
import { initApp } from './app.js?v=20251101';
import { bindHistoryUI, restoreOngoingSession } from './history.js?v=20251101';
import { bindMapUI } from './map.js?v=20251101';

document.addEventListener('DOMContentLoaded', () => {
  bindConsentUI();
  initConsent();
  bindHistoryUI();
  restoreOngoingSession();
  bindMapUI();
  initApp();
});


