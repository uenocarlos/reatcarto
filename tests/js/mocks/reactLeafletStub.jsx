import React from 'react';
import L from 'leaflet';

const mapStub = L.mapStubApi || {
  on: () => {},
  off: () => {},
  getBounds: () => ({
    getSouth: () => -35,
    getNorth: () => -30,
    getWest: () => -55,
    getEast: () => -50,
  }),
  getZoom: () => 8,
  getCenter: () => ({ lat: -30, lng: -51 }),
  latLngToContainerPoint: () => ({ x: 0, y: 0 }),
};

export const MapContainer = ({ children, center, zoom, className, ...props }) => (
  <div
    data-testid="leaflet-map-container"
    className={className}
    data-center={Array.isArray(center) ? center.join(',') : undefined}
    data-zoom={zoom}
  >
    {children}
  </div>
);
export const TileLayer = () => <div data-testid="leaflet-tile-layer" />;
export const Marker = () => <div data-testid="leaflet-marker" />;
export const Polyline = () => <div data-testid="leaflet-polyline" />;
export const Polygon = () => <div data-testid="leaflet-polygon" />;
export const GeoJSON = ({ data }) => (
  <div data-testid="leaflet-geojson" data-feature-count={data?.features?.length ?? 0} />
);

export const useMap = () => mapStub;
export const useMapEvents = () => null;
