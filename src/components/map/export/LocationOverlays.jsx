import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import { allFeatureGeometries } from '@/lib/export/geoJsonLeaflet';

export default function LocationOverlays({ overlay }) {
  const outlineGeometries = useMemo(
    () => allFeatureGeometries(overlay?.outline?.geometry),
    [overlay?.outline?.geometry]
  );
  const meshGeometries = useMemo(
    () => (overlay?.mesh?.geometry ? allFeatureGeometries(overlay.mesh.geometry) : []),
    [overlay?.mesh?.geometry]
  );

  if (!overlay?.outline?.geometry && !overlay?.mesh?.geometry) {
    return null;
  }

  return (
    <>
      {outlineGeometries.map((geometry, index) => (
        <GeoJSON
          key={`loc-outline-${overlay.outline.municipalityCode}-${index}`}
          data={{ type: 'Feature', properties: {}, geometry }}
          style={{
            color: overlay.outline.color,
            weight: 3,
            fillOpacity: 0,
          }}
        />
      ))}
      {meshGeometries.map((geometry, index) => (
        <GeoJSON
          key={`loc-mesh-${index}`}
          data={{ type: 'Feature', properties: {}, geometry }}
          style={{
            color: overlay.mesh.color,
            weight: 1,
            fillColor: overlay.mesh.color,
            fillOpacity: 0.08,
          }}
        />
      ))}
    </>
  );
}

export function useLowZoomMeshReady(meshGeometry, enabled) {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled || !meshGeometry) {
      setReady(true);
      return undefined;
    }
    setReady(false);
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, [enabled, meshGeometry]);

  return ready;
}
