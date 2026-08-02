import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getLocalTileUrl } from '@/lib/tileManager';
import { buildOfflineReadinessPayload } from '@/lib/export/basemapResolver';

function tileKey(z, x, y) {
  return `${z}:${x}:${y}`;
}

/**
 * Native offline basemap via tileManager.getLocalTileUrl.
 */
export default function OfflineTileLayer({ onReadinessChange }) {
  const map = useMap();

  useEffect(() => {
    const tileEntries = new Map();
    const tileRequestTokens = new Map();
    let requestSeq = 0;

    const emitReadiness = () => {
      onReadinessChange?.(buildOfflineReadinessPayload(tileEntries));
    };

    const OfflineGridLayer = L.GridLayer.extend({
      createTile(coords, done) {
        const key = tileKey(coords.z, coords.x, coords.y);
        const requestId = ++requestSeq;
        tileRequestTokens.set(key, requestId);
        tileEntries.set(key, undefined);
        emitReadiness();

        const isCurrent = () => tileRequestTokens.get(key) === requestId;

        const tile = document.createElement('img');
        tile.alt = '';
        tile.setAttribute('role', 'presentation');
        getLocalTileUrl(coords.z, coords.x, coords.y)
          .then((url) => {
            if (!isCurrent()) return;
            if (url) {
              tile.onload = () => {
                if (!isCurrent()) return;
                tileEntries.set(key, url);
                emitReadiness();
                done(null, tile);
              };
              tile.onerror = () => {
                if (!isCurrent()) return;
                tileEntries.set(key, null);
                emitReadiness();
                done(new Error('tile missing'), tile);
              };
              tile.src = url;
            } else {
              tileEntries.set(key, null);
              emitReadiness();
              done(new Error('tile missing'), tile);
            }
          })
          .catch(() => {
            if (!isCurrent()) return;
            tileEntries.set(key, null);
            emitReadiness();
            done(new Error('tile error'), tile);
          });
        return tile;
      },
    });

    const offlineLayer = new OfflineGridLayer({ maxZoom: 19 });
    offlineLayer.on('tileunload', (e) => {
      const { x, y, z } = e.coords;
      const key = tileKey(z, x, y);
      tileRequestTokens.delete(key);
      tileEntries.delete(key);
      if (e.tile) {
        e.tile.onload = null;
        e.tile.onerror = null;
      }
      emitReadiness();
    });
    offlineLayer.addTo(map);
    emitReadiness();

    return () => {
      offlineLayer.remove();
    };
  }, [map, onReadinessChange]);

  return null;
}
