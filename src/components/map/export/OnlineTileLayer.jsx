import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { buildOnlineReadinessPayload } from '@/lib/export/basemapResolver';

function tileKey(z, x, y) {
  return `${z}:${x}:${y}`;
}

/**
 * Online basemap with tile-load readiness for export gating (ADR-010).
 */
export default function OnlineTileLayer({ url, onReadinessChange }) {
  const map = useMap();

  useEffect(() => {
    const tileEntries = new Map();
    const tileRequestTokens = new Map();
    const tileLoadRequestIds = new WeakMap();
    let requestSeq = 0;

    const emitReadiness = () => {
      onReadinessChange?.(buildOnlineReadinessPayload(tileEntries));
    };

    const isCurrent = (key, requestId) => tileRequestTokens.get(key) === requestId;

    const layer = L.tileLayer(url, { attribution: '', crossOrigin: true });

    layer.on('tileloadstart', (e) => {
      const { x, y, z } = e.coords;
      const key = tileKey(z, x, y);
      const requestId = ++requestSeq;
      tileRequestTokens.set(key, requestId);
      tileEntries.set(key, undefined);
      if (e.tile) {
        tileLoadRequestIds.set(e.tile, requestId);
      }
      emitReadiness();
    });

    layer.on('tileload', (e) => {
      const { x, y, z } = e.coords;
      const key = tileKey(z, x, y);
      const requestId = e.tile ? tileLoadRequestIds.get(e.tile) : undefined;
      if (requestId === undefined || !isCurrent(key, requestId)) return;
      tileEntries.set(key, e.tile?.src || 'loaded');
      emitReadiness();
    });

    layer.on('tileerror', (e) => {
      const { x, y, z } = e.coords;
      const key = tileKey(z, x, y);
      const requestId = e.tile ? tileLoadRequestIds.get(e.tile) : undefined;
      if (requestId === undefined || !isCurrent(key, requestId)) return;
      tileEntries.set(key, null);
      emitReadiness();
    });

    layer.on('tileunload', (e) => {
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

    layer.addTo(map);
    emitReadiness();

    return () => {
      layer.remove();
    };
  }, [map, url, onReadinessChange]);

  return null;
}
