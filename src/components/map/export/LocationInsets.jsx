import React, { useEffect, useMemo } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import { geoJsonToLeafletPositions, firstFeatureGeometry } from '@/lib/export/geoJsonLeaflet';

function InsetBoundsFitter({ layers }) {
  const map = useMap();
  useEffect(() => {
    const bounds = [];
    layers.forEach((layer) => {
      const positions = geoJsonToLeafletPositions(layer);
      if (!positions) return;
      if (Array.isArray(positions[0]?.[0])) {
        positions.flat().forEach(([lat, lng]) => bounds.push([lat, lng]));
      } else {
        positions.forEach(([lat, lng]) => bounds.push([lat, lng]));
      }
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [4, 4] });
    }
  }, [layers, map]);
  return null;
}

function InsetMap({ title, layers, highlightGeometry, highlightColor = '#DC2626' }) {
  const validLayers = useMemo(
    () => layers.map((geo) => firstFeatureGeometry(geo)).filter(Boolean),
    [layers]
  );
  const highlight = firstFeatureGeometry(highlightGeometry);

  return (
    <div
      className="border border-gray-400 bg-white shadow-sm overflow-hidden flex flex-col"
      data-testid={`location-inset-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="text-[8px] font-semibold px-1 py-0.5 bg-gray-100 border-b truncate">{title}</div>
      <div className="relative w-full h-16 sm:h-20">
        <MapContainer
          center={[-15, -52]}
          zoom={3}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <InsetBoundsFitter layers={[...validLayers, highlight].filter(Boolean)} />
          {validLayers.map((geometry, index) => (
            <GeoJSON
              key={`base-${index}`}
              data={{ type: 'Feature', properties: {}, geometry }}
              style={{ color: '#64748B', weight: 1, fillColor: '#E2E8F0', fillOpacity: 0.35 }}
            />
          ))}
          {highlight && (
            <GeoJSON
              data={{ type: 'Feature', properties: {}, geometry: highlight }}
              style={{ color: highlightColor, weight: 2, fillColor: highlightColor, fillOpacity: 0.45 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default function LocationInsets({ descriptors = [], municipalityColor = '#DC2626', stateColor = '#1D4ED8' }) {
  if (!descriptors?.length) return null;

  return (
    <div
      className="absolute bottom-2 right-2 z-[600] flex flex-col gap-1 max-w-[42%]"
      data-testid="location-insets"
      data-inset-count={descriptors.length}
    >
      {descriptors.map((descriptor) => {
        if (descriptor.kind === 'sa-context') {
          return (
            <InsetMap
              key={descriptor.id}
              title="América do Sul"
              layers={[descriptor.geometry]}
              highlightGeometry={descriptor.stateGeometry}
              highlightColor={stateColor}
            />
          );
        }
        return (
          <InsetMap
            key={descriptor.id}
            title="UF + Município"
            layers={[descriptor.stateGeometry]}
            highlightGeometry={descriptor.municipalityGeometry}
            highlightColor={municipalityColor}
          />
        );
      })}
    </div>
  );
}
