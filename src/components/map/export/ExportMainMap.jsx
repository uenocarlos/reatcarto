import React, { useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { resolveBasemapTileUrl } from '@/lib/export';
import ExportElementLayers from './ExportElementLayers';
import ExportLocationOverlay from './ExportLocationOverlay';
import {
  GraticuleOverlay,
  MapChromeOverlay,
  CollisionMonitor,
  MapViewSync,
  TileReadyTracker,
} from './MapChrome';
import DecorativeFrame from './DecorativeFrame';
import './exportComposition.css';

/** Leaflet measures the container once; dialog animations leave it at 0×0 until resize. */
function InvalidateSizeOnMount() {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof map.invalidateSize !== 'function') return undefined;

    const refresh = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* mock or unmounted map */
      }
    };

    refresh();
    const frame = requestAnimationFrame(refresh);
    const t1 = window.setTimeout(refresh, 50);
    const t2 = window.setTimeout(refresh, 250);
    const t3 = window.setTimeout(refresh, 600);

    const container = typeof map.getContainer === 'function' ? map.getContainer() : null;
    const parent = container?.parentElement;
    let observer;
    if (typeof ResizeObserver !== 'undefined' && parent) {
      observer = new ResizeObserver(() => refresh());
      observer.observe(parent);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

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
            <InvalidateSizeOnMount />
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
