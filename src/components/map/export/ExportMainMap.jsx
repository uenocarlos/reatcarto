import React, { useCallback } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { resolveBasemapTileUrl } from '@/lib/export';
import ExportElementLayers from './ExportElementLayers';
import ExportLocationOverlay from './ExportLocationOverlay';
import DecorativeFrame from './DecorativeFrame';
import {
  GraticuleOverlay,
  MapChromeOverlay,
  MapInvalidateSize,
  CollisionMonitor,
  MapViewSync,
  TileReadyTracker,
} from './MapChrome';
import './exportComposition.css';

export default function ExportMainMap({
  center,
  zoom,
  elements = [],
  hiddenIds,
  basemap = 'branco',
  showLabels = false,
  locationCount = 0,
  locations = [],
  showMunicipalMesh = false,
  stateOnLegend = false,
  stateColor = '#D9E6A4',
  municipioColor = '#E6A4A4',
  northPosition = { xPct: 8, yPct: 68 },
  northSizePx = 70,
  scalePosition = { xPct: 3, yPct: 86 },
  scaleSizePx = 140,
  className = '',
  interactive = true,
  onViewChange,
  onTilesReadyChange,
  onGeoLoadError,
  onChromeChange,
  onCollisionChange,
  fetchFn,
}) {
  const tileUrl = resolveBasemapTileUrl(basemap);

  const handleTiles = useCallback((ready) => {
    onTilesReadyChange?.(ready);
  }, [onTilesReadyChange]);

  return (
    <div className={`export-main-map ${className}`.trim()} data-testid="export-main-map">
      <DecorativeFrame>
        <div className="export-main-map__surface">
          <MapContainer
            center={[center?.lat ?? 0, center?.lng ?? 0]}
            zoom={zoom ?? 10}
            scrollWheelZoom={interactive}
            dragging={interactive}
            doubleClickZoom={interactive}
            zoomControl={false}
            attributionControl={false}
            className="export-main-map__leaflet"
            data-testid="export-main-map-leaflet"
          >
            <MapInvalidateSize />
            <TileReadyTracker basemap={basemap} onReadyChange={handleTiles} />
            {onViewChange ? <MapViewSync onViewChange={onViewChange} /> : null}
            <TileLayer url={tileUrl} crossOrigin="anonymous" />
            <ExportLocationOverlay
              locationCount={locationCount}
              locations={locations}
              showMunicipalMesh={showMunicipalMesh}
              stateOnLegend={stateOnLegend}
              stateColor={stateColor}
              municipioColor={municipioColor}
              onGeoLoadError={onGeoLoadError}
              fetchFn={fetchFn}
            />
            <ExportElementLayers elements={elements} hiddenIds={hiddenIds} showLabels={showLabels} />
            <GraticuleOverlay />
            <MapChromeOverlay
              northPosition={northPosition}
              northSizePx={northSizePx}
              scalePosition={scalePosition}
              scaleSizePx={scaleSizePx}
              onChromeChange={onChromeChange}
            />
            <CollisionMonitor
              elements={elements}
              hiddenIds={hiddenIds}
              onCollisionChange={onCollisionChange}
            />
          </MapContainer>
        </div>
      </DecorativeFrame>
    </div>
  );
}
