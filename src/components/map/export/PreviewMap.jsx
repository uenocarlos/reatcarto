import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getIconSvg } from '../iconSvgs';
import { safeParseGeojson, safeParseStyle } from '@/lib/export/elementStyle';
import { computeDynamicScaleBar } from '@/lib/export/dynamicScale';
import LocationOverlays from './LocationOverlays';
import GraticuleOverlay from './GraticuleOverlay';
import OfflineTileLayer from './OfflineTileLayer';
import OnlineTileLayer from './OnlineTileLayer';

const getDashArray = (style) => {
  if (style === 'dashed') return '10 6';
  if (style === 'dotted-dashed') return '2 4 10 4';
  return null;
};

const createIcon = (color, iconName, customUrl) => {
  if (customUrl) {
    return L.icon({ iconUrl: customUrl, iconSize: [24, 24], iconAnchor: [12, 24], className: '' });
  }
  const svg = getIconSvg(iconName || 'pin', color || '#F97316');
  return L.divIcon({
    html: `<div>${svg}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    className: '',
  });
};

function BoundsFitter({ elements }) {
  const map = useMap();
  useEffect(() => {
    const allCoords = [];
    elements?.forEach((el) => {
      const geo = safeParseGeojson(el.geojson);
      if (!geo) return;
      if (geo.type === 'Point') allCoords.push([geo.coordinates[1], geo.coordinates[0]]);
      else if (geo.type === 'LineString') geo.coordinates.forEach((c) => allCoords.push([c[1], c[0]]));
      else if (geo.type === 'Polygon') geo.coordinates[0]?.forEach((c) => allCoords.push([c[1], c[0]]));
    });
    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [30, 30] });
    }
  }, [elements, map]);
  return null;
}

function MapZoomReporter({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    const report = () => {
      const center = map.getCenter();
      onZoomChange?.({ zoom: map.getZoom(), lat: center.lat, lng: center.lng });
    };
    report();
    map.on('moveend zoomend', report);
    return () => {
      map.off('moveend zoomend', report);
    };
  }, [map, onZoomChange]);
  return null;
}

function TagMarkers({ tagDescriptors }) {
  return tagDescriptors?.map((tag) => (
    <Marker
      key={`tag-${tag.elementId}`}
      position={[tag.lat, tag.lng]}
      icon={L.divIcon({
        html: `<span style="font-size:10px;font-weight:600;color:#111;background:rgba(255,255,255,0.85);padding:1px 4px;border:1px solid #333;border-radius:3px;white-space:nowrap;">${tag.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`,
        className: '',
        iconAnchor: [0, 0],
      })}
      interactive={false}
    />
  ));
}

function DynamicScaleOverlay({ mapLat, mapZoom }) {
  const scale = computeDynamicScaleBar({ lat: mapLat, zoom: mapZoom, barWidthPx: 120 });
  const segmentWidth = scale.barPx / scale.segments;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 15,
          zIndex: 500,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
        data-testid="export-north-arrow"
      >
        <svg width="40" height="40" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#333" strokeWidth="1" />
          <path d="M50 5 L55 45 L50 40 L45 45 Z" fill="#e63946" stroke="#333" strokeWidth="0.5" />
          <path d="M50 95 L55 55 L50 60 L45 55 Z" fill="#333" />
          <text x="50" y="15" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#333">
            N
          </text>
        </svg>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 15,
          left: 15,
          zIndex: 500,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
        data-testid="export-dynamic-scale"
      >
        <div style={{ display: 'flex', width: `${scale.barPx}px`, fontSize: '8px', color: '#333', justifyContent: 'space-between' }}>
          <span>0</span>
          <span>{scale.label}</span>
        </div>
        <div style={{ display: 'flex', width: `${scale.barPx}px`, height: '6px', border: '1px solid #333' }}>
          {Array.from({ length: scale.segments }).map((_, i) => (
            <div key={i} style={{ width: `${segmentWidth}px`, background: i % 2 === 0 ? '#333' : 'white' }} />
          ))}
        </div>
      </div>
    </>
  );
}

export default function PreviewMap({
  elements,
  basemap,
  tileUrl,
  tagDescriptors = [],
  locationOverlay = null,
  onMapViewChange,
  onBasemapReadinessChange,
}) {
  const [viewState, setViewState] = useState({ zoom: 11, lat: -32.035, lng: -52.1 });

  const handleZoomChange = (next) => {
    setViewState(next);
    onMapViewChange?.(next);
  };

  return (
    <div className="relative w-full h-full" data-testid="export-preview-map">
      <MapContainer
        center={[-32.035, -52.1]}
        zoom={11}
        style={{ width: '100%', height: '100%' }}
        zoomControl
        attributionControl={false}
      >
        {basemap === 'offline' ? (
          <OfflineTileLayer onReadinessChange={onBasemapReadinessChange} />
        ) : (
          <OnlineTileLayer
            key={basemap}
            url={tileUrl}
            onReadinessChange={onBasemapReadinessChange}
          />
        )}
        <BoundsFitter elements={elements} />
        <GraticuleOverlay />
        <MapZoomReporter onZoomChange={handleZoomChange} />
        <TagMarkers tagDescriptors={tagDescriptors} />
        <LocationOverlays overlay={locationOverlay} />
        {elements?.map((el) => {
          const geo = safeParseGeojson(el.geojson);
          if (!geo) return null;
          const style = safeParseStyle(el.style);
          if (el.element_type === 'point') {
            const icon = createIcon(style.icon_color, style.icon_name, style.custom_icon_url);
            return <Marker key={el.id} position={[geo.coordinates[1], geo.coordinates[0]]} icon={icon} />;
          }
          if (el.element_type === 'line') {
            return (
              <Polyline
                key={el.id}
                positions={geo.coordinates.map((c) => [c[1], c[0]])}
                pathOptions={{
                  color: style.color || '#F97316',
                  weight: style.weight || 3,
                  dashArray: getDashArray(style.dash_style),
                }}
              />
            );
          }
          if (el.element_type === 'polygon') {
            return (
              <Polygon
                key={el.id}
                positions={geo.coordinates[0].map((c) => [c[1], c[0]])}
                pathOptions={{
                  color: style.border_color || '#F97316',
                  weight: style.border_weight || 2,
                  fillColor: style.fill_color || '#FED7AA',
                  fillOpacity: (style.fill_opacity || 40) / 100,
                  dashArray: getDashArray(style.border_dash),
                }}
              />
            );
          }
          return null;
        })}
      </MapContainer>
      <DynamicScaleOverlay mapLat={viewState.lat} mapZoom={viewState.zoom} />
    </div>
  );
}
