import { initConsent, bindConsentUI } from './consent.js';
import { initApp } from './app.js';
import { bindHistoryUI, restoreOngoingSession } from './history.js';

document.addEventListener('DOMContentLoaded', () => {
  bindConsentUI();
  initConsent();
  bindHistoryUI();
  restoreOngoingSession();
  initApp();
});


