const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 240;
const COMPLETION_THRESHOLD = 0.9; // coverage required before we accept the trace
const SAMPLE_STEP = 2; // px between sampled points along the stroke

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
  const neighborRadius = options.neighborRadius || Math.max(6, Math.round(guideStrokeWidth * 0.6));
  const requireRatio = options.completionThreshold ?? COMPLETION_THRESHOLD;

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
      <div class="trace-overlay__actions">
        <button type="button" class="trace-overlay__done" disabled>Done</button>
      </div>
      <div class="trace-overlay__hint">Use your finger or mouse to trace the outline completely.</div>
    </div>
  `;

  document.body.appendChild(overlayEl);

  const canvas = overlayEl.querySelector('.trace-overlay__canvas');
  const progressBar = overlayEl.querySelector('.trace-overlay__progress-bar');
  const progressText = overlayEl.querySelector('.trace-overlay__progress-text');
  const doneButton = overlayEl.querySelector('.trace-overlay__done');
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
  let currentRatio = 0;

  function resetCoverage() {
    coverageMask.fill(0);
    coveredCount = 0;
    completed = false;
    currentRatio = 0;
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    doneButton.disabled = true;
    doneButton.classList.remove('trace-overlay__done--ready');
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
    for (let dy = -neighborRadius; dy <= neighborRadius; dy++) {
      for (let dx = -neighborRadius; dx <= neighborRadius; dx++) {
        if (dx * dx + dy * dy > neighborRadius * neighborRadius) continue;
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
    currentRatio = Math.min(1, coveredCount / requiredCount);
    const percent = Math.round(currentRatio * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
    if (currentRatio >= requireRatio) {
      doneButton.disabled = false;
      doneButton.classList.add('trace-overlay__done--ready');
    } else {
      doneButton.disabled = false;
      doneButton.classList.remove('trace-overlay__done--ready');
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

  function blockOutsideCard(evt) {
    if (!cardEl.contains(evt.target)) {
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  function attachEvents() {
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    overlayEl.addEventListener('click', blockOutsideCard, true);
    overlayEl.addEventListener('pointerdown', blockOutsideCard, true);
    overlayEl.addEventListener('keydown', onKeyDown);
    doneButton.addEventListener('click', handleDoneClick);
  }

  function detachEvents() {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerUp);
    overlayEl.removeEventListener('click', blockOutsideCard, true);
    overlayEl.removeEventListener('pointerdown', blockOutsideCard, true);
    overlayEl.removeEventListener('keydown', onKeyDown);
    doneButton.removeEventListener('click', handleDoneClick);
  }

  function onKeyDown(evt) {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      evt.stopPropagation();
      finish(false);
    }
  }

  function handleDoneClick() {
    if (!activePromise) return;
    // Mark as completed if ratio meets threshold; otherwise still allow but do not set completed flag.
    if (currentRatio >= requireRatio) {
      completed = true;
    }
    finish(true, { ratio: currentRatio, completed });
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

  function finish(success, details) {
    if (!activePromise) return;
    hideOverlay();
    const resolve = resolveActive;
    const reject = rejectActive;
    resolveActive = null;
    rejectActive = null;
    const promise = activePromise;
    activePromise = null;
    if (success) {
      resolve(details || {});
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


