import { startSession, incrementCount, endSession, updateSessionScoreStats } from './history.js?v=20251107';
import { createTraceOverlay } from './traceOverlay.js?v=20251107';

const pageEl = document.getElementById('page');
const lineEl = document.getElementById('line');
const counterEl = document.getElementById('counter');
const toggleButton = document.getElementById('toggleButton');
const backgroundSwitcher = document.getElementById('backgroundSwitcher');
const soundToggle = document.getElementById('soundToggle');
const whatsappShare = document.getElementById('whatsappShare');
const hanumanEl = document.getElementById('hanuman');
const sessionBestEl = document.getElementById('sessionBestScore');
const allTimeBestEl = document.getElementById('allTimeBestScore');
const sessionAvgEl = document.getElementById('sessionAvgScore');

const SCORE_STORAGE_KEY = 'ramTraceScoreStats';

let canUseLocalStorage = true;

let sessionBestScore = 0;
let sessionScoreCount = 0;
let sessionScoreTotal = 0;
let sessionAverageScore = 0;
let allTimeBestScore = 0;

let count = 0;
let isWritingEnabled = true;
let isSoundEnabled = false;
let audioElement;
let traceOverlayInstance = null;

const backgroundImages = [
  './ramji shabri.jpg',
  './Shree Ram Wallpaper Enwallpaper.jpg',
  './raji_hanumanji.jpg',
  './ram_sitaji.jpg',
  './ramji birth.jpg',
  './ramji kevat.jpg',
  './ramji_ayodhya.jpg',
  './ramji_combat.jpg',
  './ramji_setu.jpg',
  './ramji2.jpg',
  './lord-ram-background.jpg'
];
let currentBackgroundIndex = 0;

function formatScoreValue(value, fractionDigits = 0) {
  if (!Number.isFinite(value)) return '0';
  if (fractionDigits <= 0) {
    return String(Math.round(value));
  }
  return value.toFixed(fractionDigits);
}

function updateScoreDisplay() {
  if (sessionBestEl) {
    sessionBestEl.textContent = formatScoreValue(sessionBestScore);
  }
  if (allTimeBestEl) {
    allTimeBestEl.textContent = formatScoreValue(allTimeBestScore);
  }
  if (sessionAvgEl) {
    const digits = sessionScoreCount > 0 ? 1 : 0;
    sessionAvgEl.textContent = formatScoreValue(sessionAverageScore, digits);
  }
}

function loadStoredScoreSnapshot() {
  if (!canUseLocalStorage) return null;
  try {
    const raw = localStorage.getItem(SCORE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.allTimeBest === 'number' && !Number.isNaN(parsed.allTimeBest)) {
      allTimeBestScore = Math.max(0, Math.round(parsed.allTimeBest));
    }
    return parsed;
  } catch (err) {
    canUseLocalStorage = false;
    console.warn('Unable to load stored trace scores', err);
    return null;
  }
}

function resetSessionScoreState() {
  sessionBestScore = 0;
  sessionScoreCount = 0;
  sessionScoreTotal = 0;
  sessionAverageScore = 0;
}

function persistScoreStats() {
  if (!canUseLocalStorage) return;
  try {
    const payload = {
      allTimeBest: allTimeBestScore,
      sessionBest: sessionBestScore,
      sessionAvg: Number(sessionAverageScore.toFixed(2)),
      sessionCount: sessionScoreCount,
      sessionTotal: sessionScoreTotal
    };
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    canUseLocalStorage = false;
    console.warn('Unable to persist trace score stats', err);
  }
}

function recordTraceScore(rawScore) {
  const normalized = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  sessionScoreCount += 1;
  sessionScoreTotal += normalized;
  sessionBestScore = Math.max(sessionBestScore, normalized);
  sessionAverageScore = sessionScoreCount > 0 ? sessionScoreTotal / sessionScoreCount : 0;
  allTimeBestScore = Math.max(allTimeBestScore, normalized);
  updateScoreDisplay();
  persistScoreStats();
  updateSessionScoreStats({
    best: sessionBestScore,
    avg: sessionAverageScore
  });
}

function initScoreTracking() {
  loadStoredScoreSnapshot();
  resetSessionScoreState();
  updateScoreDisplay();
  persistScoreStats();
}

function createAnimatedRam() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "word");
  const textStroke = document.createElementNS(ns, "text");
  textStroke.setAttribute("class", "stroke");
  textStroke.setAttribute("x", "0");
  textStroke.setAttribute("y", "0");
  textStroke.setAttribute("dominant-baseline", "hanging");
  textStroke.setAttribute("font-family", "'Kalam', 'Noto Sans Devanagari', sans-serif");
  textStroke.setAttribute("font-size", "1em");
  textStroke.textContent = "राम";

  const textFill = document.createElementNS(ns, "text");
  textFill.setAttribute("class", "fill");
  textFill.setAttribute("x", "0");
  textFill.setAttribute("y", "0");
  textFill.setAttribute("dominant-baseline", "hanging");
  textFill.setAttribute("font-family", "'Kalam', 'Noto Sans Devanagari', sans-serif");
  textFill.setAttribute("font-size", "1em");
  textFill.textContent = "राम";

  svg.appendChild(textStroke);
  svg.appendChild(textFill);

  svg.style.position = "absolute";
  svg.style.visibility = "hidden";
  lineEl.appendChild(svg);
  const bbox = textStroke.getBBox();
  const pad = 2;
  const w = Math.ceil(bbox.width + pad * 2);
  const h = Math.ceil(bbox.height + pad * 2);
  svg.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${w} ${h}`);
  svg.style.position = "";
  svg.style.visibility = "";

  const approxLen = Math.max(300, Math.round((bbox.width + bbox.height) * 6));
  textStroke.style.strokeDasharray = approxLen;
  textStroke.style.strokeDashoffset = approxLen;

  return svg;
}

function addGap(){
  const gap = document.createElement("span");
  gap.className = "gap";
  gap.textContent = " ";
  lineEl.appendChild(gap);
}

function flashCounter(){
  counterEl.classList.add("flash");
  setTimeout(()=>counterEl.classList.remove("flash"), 200);
}

function updateCounter(){
  counterEl.textContent = `${count} ✍️`;
  flashCounter();
}

function triggerHanumanChanting() {
  hanumanEl.classList.add('chanting');
  setTimeout(() => {
    hanumanEl.classList.remove('chanting');
  }, 800);
}

function initAudio() {
  if (!audioElement) {
    audioElement = new Audio('./chant1_radio.mp3');
    audioElement.volume = 0.3;
    audioElement.preload = 'auto';
  }
}

function playRamSound() {
  if (!isSoundEnabled) return;
  initAudio();
  audioElement.currentTime = 0;
  audioElement.play().catch(() => {});
}

function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  if (isSoundEnabled) {
    soundToggle.textContent = "🔊";
    soundToggle.classList.remove('disabled');
    playRamSound();
  } else {
    soundToggle.textContent = "🔇";
    soundToggle.classList.add('disabled');
  }
}

function ensureTraceOverlay(){
  if (!traceOverlayInstance) {
    traceOverlayInstance = createTraceOverlay({ text: 'राम' });
  }
  return traceOverlayInstance;
}

function performWriteRam(){
  if (!isWritingEnabled) return;
  if (count > 0) addGap();
  const svgWord = createAnimatedRam();
  lineEl.appendChild(svgWord);
  count++;
  updateCounter();
  incrementCount();
  triggerHanumanChanting();
  playRamSound();
}

function requestRamWrite(){
  if (!isWritingEnabled) return;
  const overlay = ensureTraceOverlay();
  if (overlay.isActive()) return;
  overlay.start()
    .then((result) => {
      const ratio = typeof result?.ratio === 'number' ? result.ratio : 0;
      recordTraceScore(ratio * 100);
      if (!isWritingEnabled) return;
      performWriteRam();
    })
    .catch(() => {
      // Overlay dismissed; do nothing.
    });
}

function toggleWriting() {
  isWritingEnabled = !isWritingEnabled;
  if (isWritingEnabled) {
    toggleButton.textContent = "Pause";
    toggleButton.classList.remove('disabled');
  } else {
    toggleButton.textContent = "Start Writing";
    toggleButton.classList.add('disabled');
  }
}

function switchBackground() {
  currentBackgroundIndex = (currentBackgroundIndex + 1) % backgroundImages.length;
  const newImage = backgroundImages[currentBackgroundIndex];
  document.body.style.backgroundImage = `url('${newImage}'), linear-gradient(90deg, transparent 0 64px, var(--margin) 64px 66px, transparent 66px), repeating-linear-gradient(to bottom, var(--paper), var(--paper) calc(var(--font-size) * var(--line-height) - 2px), var(--rule) 0, var(--rule) calc(var(--font-size) * var(--line-height)))`;
  document.body.style.backgroundSize = 'cover, 100% 100%, 100% 100%';
  document.body.style.backgroundPosition = 'center center, 0 0, 0 0';
  document.body.style.backgroundRepeat = 'no-repeat, no-repeat, repeat';
  document.body.style.backgroundAttachment = 'fixed, scroll, scroll';
}

function shareToWhatsApp() {
  const currentUrl = window.location.href;
  const text = `राम नाम मनिदीप धरु जीह देहरीं द्वार।
तुलसी भीतर बाहेरहुँ जौं चाहसि उजिआर॥

Experience the divine journey of writing "राम" with this beautiful app!

Visit: ${currentUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(whatsappUrl, '_blank');
}

function removeLast(){
  if (!lineEl.lastChild) return;
  if (lineEl.lastChild.classList?.contains("gap")){
    lineEl.removeChild(lineEl.lastChild);
    if (lineEl.lastChild) lineEl.removeChild(lineEl.lastChild);
  } else {
    lineEl.removeChild(lineEl.lastChild);
  }
  count = Math.max(0, count - 1);
  updateCounter();
}

export function initApp() {
  initScoreTracking();
  if (pageEl) pageEl.focus({ preventScroll: true });
  toggleButton.textContent = "Pause";
  toggleButton.classList.remove('disabled');
  soundToggle.classList.add('disabled');
  soundToggle.textContent = "🔇";
  startSession();
  ensureTraceOverlay();

  toggleButton.addEventListener("click", toggleWriting);
  backgroundSwitcher.addEventListener("click", switchBackground);
  soundToggle.addEventListener("click", toggleSound);
  whatsappShare.addEventListener("click", shareToWhatsApp);

  document.addEventListener("keydown", (e) => {
    const historyModal = document.getElementById('historyModal');
    const mapModal = document.getElementById('mapModal');
    if ((historyModal && historyModal.classList.contains('show')) || (mapModal && mapModal.classList.contains('show'))) return; // ignore keys when any modal open
    if (e.code === "Space") {
      e.preventDefault();
      requestRamWrite();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      removeLast();
    }
  });

  document.addEventListener("pointerdown", (e) => {
    const historyModal = document.getElementById('historyModal');
    const mapModal = document.getElementById('mapModal');
    if (historyModal && historyModal.classList.contains('show')) {
      if (e.target && historyModal.contains(e.target)) return;
    }
    if (mapModal && mapModal.classList.contains('show')) {
      if (e.target && mapModal.contains(e.target)) return;
    }
    const tag = (e.target.tagName || "").toLowerCase();
    if (["a","button","input","textarea","select","label"].includes(tag)) return;
    requestRamWrite();
  }, { passive: true });

  window.addEventListener('beforeunload', () => {
    endSession();
  });
}


