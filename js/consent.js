const CONSENT_KEY = 'analytics_consent';
const GA_MEASUREMENT_ID = 'G-1DMWLTPZHE';

function hasConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}

function hasDeclined() {
  return localStorage.getItem(CONSENT_KEY) === 'declined';
}

function saveConsent(consent) {
  localStorage.setItem(CONSENT_KEY, consent);
}

function loadGoogleAnalytics() {
  const existing = document.getElementById('google-analytics-script');
  if (!existing) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.id = 'google-analytics-script';
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);} // eslint-disable-line no-inner-declarations
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
}

function disableGoogleAnalytics() {
  const existingScript = document.getElementById('google-analytics-script');
  if (existingScript) existingScript.remove();
  if (window.dataLayer) window.dataLayer = [];
  window.gtag = function() {
    // disabled
  };
}

function showConsentPopup() {
  const popup = document.getElementById('consentPopup');
  if (popup) popup.classList.add('show');
}

function hideConsentPopup() {
  const popup = document.getElementById('consentPopup');
  if (popup) popup.classList.remove('show');
}

function acceptAnalytics() {
  saveConsent('accepted');
  hideConsentPopup();
  loadGoogleAnalytics();
}

function declineAnalytics() {
  saveConsent('declined');
  hideConsentPopup();
  disableGoogleAnalytics();
}

export function initConsent() {
  if (hasConsent()) {
    loadGoogleAnalytics();
  } else if (hasDeclined()) {
    disableGoogleAnalytics();
  } else {
    setTimeout(showConsentPopup, 1000);
  }
}

export function bindConsentUI() {
  const acceptBtn = document.getElementById('acceptAnalytics');
  const declineBtn = document.getElementById('declineAnalytics');
  const privacyLink = document.getElementById('privacyLink');

  if (acceptBtn) acceptBtn.addEventListener('click', acceptAnalytics);
  if (declineBtn) declineBtn.addEventListener('click', declineAnalytics);
  if (privacyLink) {
    privacyLink.addEventListener('click', function(e) {
      e.preventDefault();
      alert('Privacy Policy: We collect anonymous usage data through Google Analytics to improve our service. No personal information is collected.');
    });
  }
}


