import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const TILE_DIR = 'offline_tiles';

// Helper to convert lat/lng to tile x/y
export const latLngToTile = (lat, lng, zoom) => {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
};

export const downloadTile = async (z, x, y) => {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const path = `${TILE_DIR}/${z}/${x}/${y}.png`;

  try {
    // Check if file already exists
    try {
      await Filesystem.stat({
        path,
        directory: Directory.Data,
      });
      return true; // Already exists
    } catch (e) {
      // Continue to download
    }

    const response = await fetch(url);
    const blob = await response.blob();
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });
    reader.readAsDataURL(blob);
    const base64Data = await base64Promise;

    // Ensure directory exists
    await Filesystem.mkdir({
      path: `${TILE_DIR}/${z}/${x}`,
      directory: Directory.Data,
      recursive: true,
    });

    await Filesystem.writeFile({
      path,
      directory: Directory.Data,
      data: base64Data,
    });
    return true;
  } catch (error) {
    console.error(`Failed to download tile ${z}/${x}/${y}:`, error);
    return false;
  }
};

export const getLocalTileUrl = async (z, x, y) => {
  const path = `${TILE_DIR}/${z}/${x}/${y}.png`;
  try {
    const result = await Filesystem.getUri({
      path,
      directory: Directory.Data,
    });
    return Capacitor.convertFileSrc(result.uri);
  } catch (e) {
    return null;
  }
};

export const clearOfflineTiles = async () => {
  try {
    await Filesystem.rmdir({
      path: TILE_DIR,
      directory: Directory.Data,
      recursive: true,
    });
    return true;
  } catch (e) {
    console.error('Failed to clear tiles:', e);
    return false;
  }
};

export const getOfflineStats = async () => {
  try {
    const result = await Filesystem.readdir({
      path: TILE_DIR,
      directory: Directory.Data,
    });
    // This is a simple count of top-level folders (zoom levels)
    // A more thorough implementation would recurse.
    return { exists: true, zoomLevels: result.files.length };
  } catch (e) {
    return { exists: false, zoomLevels: 0 };
  }
};
