/**
 * Location tracking and API integration
 * Captures user location and sends it to Parse API
 */

const PARSE_API_URL = 'https://parseapi.back4app.com/functions/addOrUpdateUser';
const PARSE_APP_ID = 'yKujveqA2lJWMJ0mJhWGYudoMncTnfE7a5HKoaNZ';
const PARSE_REST_API_KEY = 'IMAEUdc6b4zfa4iVHMKvzzG5XjouNqtnLf4cqynn';

// Generate or retrieve a persistent user ID
function getUserId() {
  const STORAGE_KEY = 'ram_user_id';
  let userId = localStorage.getItem(STORAGE_KEY);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, userId);
  }
  return userId;
}

// Get current ram count from the session
function getRamCount() {
  try {
    const raw = sessionStorage.getItem('ram_current_session');
    if (raw) {
      const session = JSON.parse(raw);
      return session?.count || 0;
    }
  } catch (_e) {
    // ignore errors
  }
  return 0;
}

// Reverse geocode coordinates to get place name
async function reverseGeocode(latitude, longitude) {
  try {
    // Using Nominatim (OpenStreetMap) for reverse geocoding
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RamNamaApp/1.0' // Required by Nominatim
      }
    });
    
    if (!response.ok) {
      throw new Error('Geocoding failed');
    }
    
    const data = await response.json();
    
    // Format place name from address components with better priority
    const address = data.address || {};
    const parts = [];
    
    // Priority: city > town > village > municipality > county
    if (address.city) {
      parts.push(address.city);
    } else if (address.town) {
      parts.push(address.town);
    } else if (address.village) {
      parts.push(address.village);
    } else if (address.municipality) {
      parts.push(address.municipality);
    } else if (address.county) {
      parts.push(address.county);
    }
    
    // Add state/province if available
    if (address.state) {
      parts.push(address.state);
    } else if (address.province) {
      parts.push(address.province);
    }
    
    // Add country
    if (address.country) {
      parts.push(address.country);
    }
    
    // If we have a formatted place name, use it
    if (parts.length > 0) {
      return parts.join(', ');
    }
    
    // Fallback to display_name if address parsing fails
    if (data.display_name) {
      // Try to extract a meaningful place name from display_name
      const displayParts = data.display_name.split(',');
      if (displayParts.length >= 2) {
        // Take first two parts (usually city/region, country)
        return displayParts.slice(0, 2).map(p => p.trim()).join(', ');
      }
      return data.display_name;
    }
    
    // Last resort: return coordinates
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

// Send location data to Parse API
async function sendLocationToAPI(latitude, longitude, place, ramCount) {
  const userId = getUserId();
  
  const payload = {
    userId: userId,
    latitude: latitude,
    longitude: longitude,
    place: place,
    ramCount: ramCount
  };
  
  try {
    const response = await fetch(PARSE_API_URL, {
      method: 'POST',
      headers: {
        'X-Parse-Application-Id': PARSE_APP_ID,
        'X-Parse-REST-API-Key': PARSE_REST_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Location sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to send location to API:', error);
    throw error;
  }
}

// Main function to capture location and send to API
export async function captureAndSendLocation() {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser');
    return;
  }
  
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const ramCount = getRamCount();
          
          // Reverse geocode to get place name
          const place = await reverseGeocode(latitude, longitude);
          
          // Send to API
          await sendLocationToAPI(latitude, longitude, place, ramCount);
          
          console.log('Location captured and sent:', { latitude, longitude, place, ramCount });
          resolve({ latitude, longitude, place, ramCount });
        } catch (error) {
          console.error('Error processing location:', error);
          reject(error);
        }
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        // Don't reject - just log the error, location is optional
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Don't use cached location
      }
    );
  });
}

// Interval ID for periodic location updates
let locationIntervalId = null;

// Initialize location capture when app loads
export function initLocationTracking() {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser');
    return;
  }
  
  // Function to send location (with error handling)
  const sendLocation = () => {
    captureAndSendLocation().catch((error) => {
      // Silently fail - location tracking is optional
      console.warn('Location tracking failed:', error);
    });
  };
  
  // Send location immediately after a short delay to ensure app is fully loaded
  setTimeout(() => {
    sendLocation();
  }, 1000);
  
  // Set up interval to send location every 2 minutes (120000 milliseconds)
  locationIntervalId = setInterval(() => {
    sendLocation();
  }, 120000); // 2 minutes = 120000 ms
  
  // Clean up interval when page unloads
  window.addEventListener('beforeunload', () => {
    if (locationIntervalId) {
      clearInterval(locationIntervalId);
      locationIntervalId = null;
    }
  });
}

