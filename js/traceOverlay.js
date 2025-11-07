const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 240;
const COMPLETION_THRESHOLD = 0.7; // 70% coverage required
const SAMPLE_STEP = 2; // px between sampled points along the stroke
const NEIGHBOR_RADIUS = 3; // px radius to credit coverage around sampled point

function waitForFonts() {
  if (document.fonts && document.fonts.ready) {
    return document.fonts.ready.catch(() => {});
  }
  return Promise.resolve();
}

export function createTraceOverlay(options = {}) {
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const text = options.text || 'राम';
  const fontFamily = options.fontFamily || "'Kalam', 'Noto Sans Devanagari', sans-serif";
  const fontSize = options.fontSize || Math.min(height * 0.75, 200);
  const guideStrokeWidth = options.guideStrokeWidth || Math.round(fontSize * 0.12);
  const userStrokeWidth = options.userStrokeWidth || Math.max(4, Math.round(fontSize * 0.07));

  const overlayEl = document.createElement('div');
  overlayEl.className = 'trace-overlay';
  overlayEl.setAttribute('aria-hidden', 'true');
  overlayEl.innerHTML = `
    <div class="trace-overlay__scrim" data-trace-layer></div>
    <div class="trace-overlay__card" role="dialog" aria-modal="true" aria-label="Trace राम">
      <div class="trace-overlay__title">Trace “${text}”</div>
      <div class="trace-overlay__canvas-wrap">
        <canvas class="trace-overlay__canvas" width="${width}" height="${height}"></canvas>
      </div>
      <div class="trace-overlay__progress-group" aria-live="polite">
        <div class="trace-overlay__progress-track">
          <div class="trace-overlay__progress-bar" style="width:0%"></div>
        </div>
        <span class="trace-overlay__progress-text">0%</span>
      </div>
      <div class="trace-overlay__hint">Use your finger or mouse to trace the outline completely.</div>
    </div>
  `;

  document.body.appendChild(overlayEl);

  const canvas = overlayEl.querySelector('.trace-overlay__canvas');
  const progressBar = overlayEl.querySelector('.trace-overlay__progress-bar');
  const progressText = overlayEl.querySelector('.trace-overlay__progress-text');
  const cardEl = overlayEl.querySelector('.trace-overlay__card');

  const ctx = canvas.getContext('2d');
  const guideCanvas = document.createElement('canvas');
  guideCanvas.width = width;
  guideCanvas.height = height;
  const guideCtx = guideCanvas.getContext('2d');

  const maskSize = width * height;
  const requiredMask = new Uint8Array(maskSize);
  const coverageMask = new Uint8Array(maskSize);

  let requiredCount = 0;
  let coveredCount = 0;
  let activePromise = null;
  let resolveActive;
  let rejectActive;
  let drawing = false;
  let lastPoint = null;
  let completed = false;

  function resetCoverage() {
    coverageMask.fill(0);
    coveredCount = 0;
    completed = false;
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
  }

  function getCanvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  }

  function markPoint(x, y) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
    const idx = iy * width + ix;
    if (!requiredMask[idx] || coverageMask[idx]) return;
    coverageMask[idx] = 1;
    coveredCount++;
  }

  function markNeighborhood(x, y) {
    for (let dy = -NEIGHBOR_RADIUS; dy <= NEIGHBOR_RADIUS; dy++) {
      for (let dx = -NEIGHBOR_RADIUS; dx <= NEIGHBOR_RADIUS; dx++) {
        if (dx * dx + dy * dy > NEIGHBOR_RADIUS * NEIGHBOR_RADIUS) continue;
        markPoint(x + dx, y + dy);
      }
    }
  }

  function sampleSegment(from, to) {
    if (!from) {
      markNeighborhood(to.x, to.y);
      return;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / SAMPLE_STEP));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      markNeighborhood(x, y);
    }
  }

  function updateProgress() {
    if (!requiredCount) return;
    const ratio = Math.min(1, coveredCount / requiredCount);
    const percent = Math.round(ratio * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
    if (!completed && ratio >= COMPLETION_THRESHOLD) {
      completed = true;
      setTimeout(() => finish(true), 120);
    }
  }

  function handlePointerDown(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    if (completed) return;
    drawing = true;
    lastPoint = getCanvasPoint(evt);
    canvas.setPointerCapture(evt.pointerId);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.82)';
    ctx.lineWidth = userStrokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    markNeighborhood(lastPoint.x, lastPoint.y);
    updateProgress();
  }

  function handlePointerMove(evt) {
    if (!drawing) return;
    const nextPoint = getCanvasPoint(evt);
    ctx.lineTo(nextPoint.x, nextPoint.y);
    ctx.stroke();
    sampleSegment(lastPoint, nextPoint);
    lastPoint = nextPoint;
    updateProgress();
  }

  function handlePointerUp(evt) {
    if (!drawing) return;
    drawing = false;
    canvas.releasePointerCapture(evt.pointerId);
    ctx.beginPath();
  }

  function blockEvent(evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }

  function attachEvents() {
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    overlayEl.addEventListener('click', blockEvent, true);
    overlayEl.addEventListener('pointerdown', blockEvent, true);
    overlayEl.addEventListener('keydown', onKeyDown);
  }

  function detachEvents() {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerUp);
    overlayEl.removeEventListener('click', blockEvent, true);
    overlayEl.removeEventListener('pointerdown', blockEvent, true);
    overlayEl.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(evt) {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      evt.stopPropagation();
      finish(false);
    }
  }

  function hideOverlay() {
    overlayEl.classList.remove('trace-overlay--active');
    overlayEl.setAttribute('aria-hidden', 'true');
    overlayEl.style.pointerEvents = 'none';
    detachEvents();
  }

  function showOverlay() {
    overlayEl.classList.add('trace-overlay--active');
    overlayEl.setAttribute('aria-hidden', 'false');
    overlayEl.style.pointerEvents = 'auto';
    attachEvents();
    setTimeout(() => {
      cardEl.focus({ preventScroll: true });
    }, 0);
  }

  function finish(success) {
    if (!activePromise) return;
    hideOverlay();
    const resolve = resolveActive;
    const reject = rejectActive;
    resolveActive = null;
    rejectActive = null;
    const promise = activePromise;
    activePromise = null;
    if (success) {
      resolve();
    } else {
      reject(new Error('Trace overlay dismissed'));
    }
    return promise;
  }

  async function prepareGuide() {
    await waitForFonts();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.25)';
    ctx.lineWidth = guideStrokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, width / 2, height / 2 + fontSize * 0.05);
    ctx.restore();

    guideCtx.clearRect(0, 0, width, height);
    guideCtx.strokeStyle = '#000';
    guideCtx.lineWidth = guideStrokeWidth;
    guideCtx.lineCap = 'round';
    guideCtx.lineJoin = 'round';
    guideCtx.font = `${fontSize}px ${fontFamily}`;
    guideCtx.textAlign = 'center';
    guideCtx.textBaseline = 'middle';
    guideCtx.strokeText(text, width / 2, height / 2 + fontSize * 0.05);

    const image = guideCtx.getImageData(0, 0, width, height);
    const data = image.data;
    requiredMask.fill(0);
    requiredCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 16) {
        const pixelIndex = i / 4;
        requiredMask[pixelIndex] = 1;
        requiredCount++;
      }
    }

    resetCoverage();
  }

  async function start() {
    if (activePromise) {
      return activePromise;
    }
    await prepareGuide();
    showOverlay();
    activePromise = new Promise((resolve, reject) => {
      resolveActive = resolve;
      rejectActive = reject;
    });
    return activePromise;
  }

  function isActive() {
    return Boolean(activePromise);
  }

  overlayEl.addEventListener('transitionend', (evt) => {
    if (evt.propertyName === 'opacity' && !overlayEl.classList.contains('trace-overlay--active')) {
      overlayEl.style.pointerEvents = 'none';
    }
  });

  overlayEl.addEventListener('click', (evt) => {
    if (evt.target.dataset?.traceLayer !== undefined) {
      evt.preventDefault();
      evt.stopPropagation();
    }
  });

  cardEl.setAttribute('tabindex', '-1');
  overlayEl.style.pointerEvents = 'none';

  return {
    start,
    finish,
    isActive
  };
}


