import { startSession, incrementCount, endSession } from './history.js?v=20251101';

const pageEl = document.getElementById('page');
const lineEl = document.getElementById('line');
const counterEl = document.getElementById('counter');
const toggleButton = document.getElementById('toggleButton');
const backgroundSwitcher = document.getElementById('backgroundSwitcher');
const soundToggle = document.getElementById('soundToggle');
const whatsappShare = document.getElementById('whatsappShare');
const hanumanEl = document.getElementById('hanuman');

let count = 0;
let isWritingEnabled = true;
let isSoundEnabled = false;
let audioElement;

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

function writeRam(){
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
  if (pageEl) pageEl.focus({ preventScroll: true });
  toggleButton.textContent = "Pause";
  toggleButton.classList.remove('disabled');
  soundToggle.classList.add('disabled');
  soundToggle.textContent = "🔇";
  startSession();

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
      writeRam();
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
    writeRam();
  }, { passive: true });

  window.addEventListener('beforeunload', () => {
    endSession();
  });
}


