// Parse API configuration
const PARSE_API_URL = 'https://parseapi.back4app.com/functions/getAllUsers';
const PARSE_APP_ID = 'yKujveqA2lJWMJ0mJhWGYudoMncTnfE7a5HKoaNZ';
const PARSE_REST_API_KEY = 'IMAEUdc6b4zfa4iVHMKvzzG5XjouNqtnLf4cqynn';

// Get current user ID
function getUserId() {
  const STORAGE_KEY = 'ram_user_id';
  let userId = localStorage.getItem(STORAGE_KEY);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, userId);
  }
  return userId;
}

// Fetch all users from Parse API
async function fetchAllUsers() {
  try {
    const response = await fetch(PARSE_API_URL, {
      method: 'POST',
      headers: {
        'X-Parse-Application-Id': PARSE_APP_ID,
        'X-Parse-REST-API-Key': PARSE_REST_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Failed to fetch users from API:', error);
    return [];
  }
}

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

function renderMarkers(canvas, locations, currentUserId) {
  canvas.innerHTML = '';
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  function hideAllLabels() {
    canvas.querySelectorAll('.map-label').forEach(el => { el.style.display = 'none'; });
  }
  
  if (!locations || locations.length === 0) {
    // Show loading or empty state
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'map-empty';
    emptyMsg.textContent = 'No active users found';
    emptyMsg.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #666; font-size: 14px;';
    canvas.appendChild(emptyMsg);
    return;
  }
  
  locations.forEach(loc => {
    const { x, y } = project(loc.latitude, loc.longitude, width, height);
    const marker = document.createElement('div');
    const isCurrentUser = loc.userId === currentUserId;
    marker.className = isCurrentUser ? 'map-marker map-marker-current' : 'map-marker';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    const label = document.createElement('div');
    label.className = 'map-label';
    label.textContent = `${loc.place} • ${loc.ramCount} राम`;
    label.style.display = 'none';
    marker.appendChild(label);
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = label.style.display === 'none';
      hideAllLabels();
      label.style.display = isHidden ? 'block' : 'none';
    });
    canvas.appendChild(marker);
  });
  // clicking empty canvas hides labels
  canvas.addEventListener('click', () => {
    canvas.querySelectorAll('.map-label').forEach(el => { el.style.display = 'none'; });
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

  let currentLocations = [];
  const currentUserId = getUserId();

  async function loadAndRenderMarkers() {
    // Show loading state
    canvas.innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #666; font-size: 14px;">Loading users...</div>';
    
    // Fetch users from API
    const users = await fetchAllUsers();
    currentLocations = users;
    
    // Render markers with real data
    renderMarkers(canvas, currentLocations, currentUserId);
    
    // Center view on first user or India if no users
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    let centerLat = 22;
    let centerLng = 78;
    
    if (currentLocations.length > 0) {
      // Center on current user if available, otherwise first user
      const currentUserLoc = currentLocations.find(loc => loc.userId === currentUserId);
      if (currentUserLoc) {
        centerLat = currentUserLoc.latitude;
        centerLng = currentUserLoc.longitude;
      } else {
        centerLat = currentLocations[0].latitude;
        centerLng = currentLocations[0].longitude;
      }
    }
    
    const center = project(centerLat, centerLng, width, height);
    translateX = (width / 2) - center.x;
    translateY = (height / 2) - center.y;
    applyTransform(canvas);
  }

  function open() {
    modal.classList.add('show');
    currentScale = 1; translateX = 0; translateY = 0;
    applyTransform(canvas);
    setMapBackground(canvas);
    loadAndRenderMarkers();
  }
  function close() { modal.classList.remove('show'); }

  mapBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  bindZoomPan(viewport, canvas);
  if (zoomIn) zoomIn.addEventListener('click', () => { currentScale = Math.min(6, currentScale * 1.2); applyTransform(canvas); });
  if (zoomOut) zoomOut.addEventListener('click', () => { currentScale = Math.max(0.6, currentScale * 0.8); applyTransform(canvas); });

  // re-render markers on resize to keep projection correct
  window.addEventListener('resize', () => { 
    if (modal.classList.contains('show')) {
      renderMarkers(canvas, currentLocations, currentUserId);
    }
  });
}


