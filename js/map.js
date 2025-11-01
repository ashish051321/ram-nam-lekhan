const mockLocations = [
  // India (multiple cities)
  { name: 'Delhi, India', lat: 28.6139, lng: 77.2090, count: 320 },
  { name: 'Gurugram, India', lat: 28.4595, lng: 77.0266, count: 140 },
  { name: 'Noida, India', lat: 28.5355, lng: 77.3910, count: 95 },
  { name: 'Chandigarh, India', lat: 30.7333, lng: 76.7794, count: 72 },
  { name: 'Jaipur, India', lat: 26.9124, lng: 75.7873, count: 88 },
  { name: 'Ahmedabad, India', lat: 23.0225, lng: 72.5714, count: 110 },
  { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777, count: 260 },
  { name: 'Pune, India', lat: 18.5204, lng: 73.8567, count: 128 },
  { name: 'Bengaluru, India', lat: 12.9716, lng: 77.5946, count: 212 },
  { name: 'Hyderabad, India', lat: 17.3850, lng: 78.4867, count: 160 },
  { name: 'Chennai, India', lat: 13.0827, lng: 80.2707, count: 102 },
  { name: 'Kolkata, India', lat: 22.5726, lng: 88.3639, count: 97 },
  { name: 'Lucknow, India', lat: 26.8467, lng: 80.9462, count: 66 },
  { name: 'Indore, India', lat: 22.7196, lng: 75.8577, count: 54 },
  { name: 'Nagpur, India', lat: 21.1458, lng: 79.0882, count: 44 },
  { name: 'Surat, India', lat: 21.1702, lng: 72.8311, count: 38 },
  { name: 'Patna, India', lat: 25.5941, lng: 85.1376, count: 28 },
  // Global examples
  { name: 'Washington, US', lat: 38.9072, lng: -77.0369, count: 64 },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278, count: 45 },
  { name: 'Sydney, AU', lat: -33.8688, lng: 151.2093, count: 20 },
];

// equirectangular projection to canvas coords
function project(lat, lng, width, height) {
  const x = (lng + 180) * (width / 360);
  const latRad = lat * Math.PI / 180;
  const y = (90 - lat) * (height / 180);
  return { x, y };
}

let currentScale = 1;
let translateX = 0;
let translateY = 0;
let isPanning = false;
let panStart = { x: 0, y: 0 };

const MAP_SOURCES = [
  // Wikimedia PNG thumbnails (reliable)
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/WorldMap-A_non-Frame.svg/1024px-WorldMap-A_non-Frame.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/World_map_-_low_resolution.svg/1024px-World_map_-_low_resolution.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/BlankMap-World.svg/1024px-BlankMap-World.svg.png'
];

function setMapBackground(canvas, idx = 0) {
  if (!canvas || idx >= MAP_SOURCES.length) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const mapLayer = `url('${MAP_SOURCES[idx]}') center center / cover no-repeat`;
    const gridLayers = ", radial-gradient(circle at 50% 50%, rgba(0,0,0,0.02), transparent 60%), linear-gradient(90deg, #f3f4f6 1px, transparent 1px) 0 0 / 50px 50px, linear-gradient(#f3f4f6 1px, transparent 1px) 0 0 / 50px 50px";
    canvas.style.background = mapLayer + gridLayers;
  };
  img.onerror = () => setMapBackground(canvas, idx + 1);
  img.src = MAP_SOURCES[idx];
}

function applyTransform(canvas) {
  canvas.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${currentScale})`;
}

function renderMarkers(canvas) {
  canvas.innerHTML = '';
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  mockLocations.forEach(loc => {
    const { x, y } = project(loc.lat, loc.lng, width, height);
    const marker = document.createElement('div');
    marker.className = 'map-marker';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    const label = document.createElement('div');
    label.className = 'map-label';
    label.textContent = `${loc.name} • ${loc.count}`;
    marker.appendChild(label);
    canvas.appendChild(marker);
  });
}

function bindZoomPan(viewport, canvas) {
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    const scaleFactor = delta > 0 ? 0.9 : 1.1;
    const prevScale = currentScale;
    currentScale = Math.min(6, Math.max(0.6, currentScale * scaleFactor));
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    translateX -= cx * (currentScale - prevScale);
    translateY -= cy * (currentScale - prevScale);
    applyTransform(canvas);
  }, { passive: false });

  viewport.addEventListener('pointerdown', (e) => {
    isPanning = true;
    panStart = { x: e.clientX - translateX, y: e.clientY - translateY };
  });
  window.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    translateX = e.clientX - panStart.x;
    translateY = e.clientY - panStart.y;
    applyTransform(canvas);
  });
  window.addEventListener('pointerup', () => { isPanning = false; });
}

export function bindMapUI() {
  const mapBtn = document.getElementById('mapButton');
  const modal = document.getElementById('mapModal');
  const closeBtn = document.getElementById('mapClose');
  const viewport = document.getElementById('mapViewport');
  const canvas = document.getElementById('mapCanvas');
  const zoomIn = document.getElementById('mapZoomIn');
  const zoomOut = document.getElementById('mapZoomOut');
  if (!mapBtn || !modal || !viewport || !canvas) return;

  function open() {
    modal.classList.add('show');
    currentScale = 1; translateX = 0; translateY = 0;
    applyTransform(canvas);
    setMapBackground(canvas);
    renderMarkers(canvas);
  }
  function close() { modal.classList.remove('show'); }

  mapBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  bindZoomPan(viewport, canvas);
  if (zoomIn) zoomIn.addEventListener('click', () => { currentScale = Math.min(6, currentScale * 1.2); applyTransform(canvas); });
  if (zoomOut) zoomOut.addEventListener('click', () => { currentScale = Math.max(0.6, currentScale * 0.8); applyTransform(canvas); });

  // re-render markers on resize to keep projection correct
  window.addEventListener('resize', () => { if (modal.classList.contains('show')) renderMarkers(canvas); });
}


