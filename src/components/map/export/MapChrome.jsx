import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { computeScaleLabel, formatScaleLabel } from '@/lib/export/scale';
import { EXPORT_NORTH_PATH } from '@/lib/export/branding';
import { parseElementGeojson, visibleElements } from './exportMapUtils';
import 'leaflet-graphicscale/dist/Leaflet.GraphicScale.min.css';

// Ensure plugins that patch the global L see the same instance Vite bundles.
if (typeof window !== 'undefined') {
  window.L = L;
}

/**
 * Leaflet AutoGraticule — grades lat/lon com rótulos nas bordas.
 */
export function resolveGraticuleMinDistance(map) {
  try {
    const container = map?.getContainer?.();
    const height = container?.clientHeight || 420;
    return Math.max(28, Math.min(100, Math.round(height / 4.2)));
  } catch {
    return 100;
  }
}

function createGraticuleLayer(AutoGraticule, map) {
  const layer = new AutoGraticule({
    redraw: 'move',
    minDistance: resolveGraticuleMinDistance(map),
  });
  layer.lineStyle = {
    ...layer.lineStyle,
    color: '#333',
    opacity: 0.6,
    dashArray: '2 2',
    weight: 0.6,
    interactive: false,
  };
  layer.addTo(map);
  return layer;
}

export function GraticuleOverlay() {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof map.addLayer !== 'function') return undefined;

    let cancelled = false;
    let layer = null;
    let resizeTimer = 0;

    const refresh = async () => {
      try {
        if (typeof window !== 'undefined') window.L = L;
        const mod = await import('leaflet-auto-graticule');
        const AutoGraticule = mod.default || mod;
        if (cancelled || typeof AutoGraticule !== 'function') return;
        if (layer) {
          try {
            map.removeLayer(layer);
          } catch {
            layer?.remove?.();
          }
          layer = null;
        }
        layer = createGraticuleLayer(AutoGraticule, map);
      } catch {
        layer = null;
      }
    };

    const scheduleRefresh = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        refresh();
      }, 80);
    };

    refresh();
    const delayed = window.setTimeout(refresh, 260);

    const container = typeof map.getContainer === 'function' ? map.getContainer() : null;
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(scheduleRefresh);
      resizeObserver.observe(container);
    }
    map.on?.('moveend', scheduleRefresh);
    map.on?.('zoomend', scheduleRefresh);

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      window.clearTimeout(delayed);
      resizeObserver?.disconnect();
      map.off?.('moveend', scheduleRefresh);
      map.off?.('zoomend', scheduleRefresh);
      try {
        if (layer) {
          if (map.removeLayer) map.removeLayer(layer);
          else if (layer.remove) layer.remove();
        }
      } catch {
        /* ignore */
      }
    };
  }, [map]);

  return (
    <div data-testid="export-graticule" className="export-graticule-marker" aria-hidden="true" />
  );
}

/** Leaflet measures the container once; animated parents may leave it at 0×0 until resize. */
export function MapInvalidateSize() {
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

/**
 * Escala gráfica (leaflet-graphicscale) + norte acima da escala (bottom-left).
 * Fallback segmentado para ambiente de testes / plugins indisponíveis.
 */
function clampPosition(position, element, host) {
  const hostRect = host?.getBoundingClientRect?.();
  const elementRect = element?.getBoundingClientRect?.();
  const maxX = hostRect?.width > 0 ? 100 - ((elementRect?.width || 0) / hostRect.width) * 100 : 100;
  const maxY = hostRect?.height > 0 ? 100 - ((elementRect?.height || 0) / hostRect.height) * 100 : 100;
  return {
    xPct: Math.max(0, Math.min(maxX, Number(position.xPct) || 0)),
    yPct: Math.max(0, Math.min(maxY, Number(position.yPct) || 0)),
  };
}

function MovableControl({ kind, position, sizePx, onChange, anchor = 'left', children }) {
  const ref = useRef(null);
  const dragRef = useRef(null);
  const [livePosition, setLivePosition] = useState(null);
  const effective = livePosition ?? position;

  const stopDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.last) onChange?.(kind, { position: drag.last });
    setLivePosition(null);
  }, [kind, onChange]);

  const handlePointerDown = useCallback((event) => {
    if (!onChange) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...effective },
      last: { ...effective },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [effective, onChange]);

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const host = ref.current?.parentElement;
    const hostRect = host?.getBoundingClientRect?.();
    if (!hostRect?.width || !hostRect?.height) return;
    const next = clampPosition({
      xPct: drag.origin.xPct + ((event.clientX - drag.startX) / hostRect.width) * 100,
      yPct: drag.origin.yPct + ((event.clientY - drag.startY) / hostRect.height) * 100,
    }, ref.current, host);
    drag.last = next;
    setLivePosition(next);
  }, []);

  const positionStyle = anchor === 'right'
    ? { right: `${effective.xPct}%`, top: `${effective.yPct}%`, width: `${sizePx}px` }
    : { left: `${effective.xPct}%`, top: `${effective.yPct}%`, width: `${sizePx}px` };

  return (
    <div
      ref={ref}
      className={[
        `export-map-control export-map-control--${kind}`,
        anchor === 'right' ? 'export-map-control--anchor-right' : '',
        dragRef.current ? ' is-dragging' : '',
      ].filter(Boolean).join(' ')}
      data-collision-role={kind}
      data-testid={`export-${kind}-control`}
      style={positionStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      title={onChange ? `Arraste para mover ${kind === 'north' ? 'o norte' : 'a escala'}` : undefined}
    >
      {children}
    </div>
  );
}

export const GRAPHIC_SCALE_OPTIONS = Object.freeze({
  doubleLine: true,
  fill: 'fill',
  showSubunits: false,
  lengthUnit: 'metric',
  position: 'bottomleft',
});

export function buildGraphicScaleOptions({ compact = false, maxWidth = 140 } = {}) {
  return {
    ...GRAPHIC_SCALE_OPTIONS,
    doubleLine: !compact,
    minUnitWidth: compact ? 12 : 30,
    maxUnitsWidth: maxWidth,
  };
}

function GraphicScaleControl({ map, maxWidth, compact, children }) {
  const hostRef = useRef(null);
  const [pluginReady, setPluginReady] = useState(false);

  useEffect(() => {
    if (!map) return undefined;
    let cancelled = false;
    let control = null;

    (async () => {
      try {
        if (typeof window !== 'undefined') window.L = L;
        await import('leaflet-graphicscale');
        if (cancelled || typeof L?.control?.graphicScale !== 'function') return;
        control = L.control.graphicScale(buildGraphicScaleOptions({ compact, maxWidth })).addTo(map);
        const controlElement = control?._scale || control?.getContainer?.();
        if (!controlElement || !hostRef.current || cancelled) return;
        controlElement.classList.add('export-graphic-scale-control');
        hostRef.current.replaceChildren(controlElement);
        setPluginReady(true);
      } catch {
        setPluginReady(false);
      }
    })();

    return () => {
      cancelled = true;
      setPluginReady(false);
      try {
        if (control) map.removeControl?.(control);
      } catch {
        control?._scale?.remove?.();
      }
    };
  }, [compact, map, maxWidth]);

  return (
    <>
      <div ref={hostRef} className="export-scale-bar__plugin" aria-hidden={!pluginReady} />
      <div className={pluginReady ? 'export-scale-bar__fallback is-hidden' : 'export-scale-bar__fallback'}>
        {children}
      </div>
    </>
  );
}

export function MapChromeOverlay({
  compact = false,
  northPosition,
  northSizePx,
  scalePosition,
  scaleSizePx,
  onChromeChange,
}) {
  const map = useMap();
  const chromeAnchor = compact ? 'right' : 'left';
  const resolvedNorthPosition = northPosition ?? (compact ? { xPct: 5, yPct: 48 } : { xPct: 8, yPct: 68 });
  const resolvedNorthSize = northSizePx ?? (compact ? 42 : 70);
  const resolvedScalePosition = scalePosition ?? (compact ? { xPct: 6, yPct: 63 } : { xPct: 3, yPct: 86 });
  const resolvedScaleSize = scaleSizePx ?? (compact ? 90 : 140);
  const compactChromeStyle = compact
    ? {
      '--export-compact-scale-width': `${resolvedScaleSize}px`,
      '--export-compact-north-width': `${resolvedNorthSize}px`,
    }
    : undefined;
  const barWidthPx = resolvedScaleSize;
  const [scale, setScale] = useState(() => computeScaleLabel({ lat: -32, zoom: 11, barWidthPx }));

  useEffect(() => {
    if (!map) return undefined;

    const updateScale = () => {
      try {
        const center = typeof map.getCenter === 'function' ? map.getCenter() : null;
        const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 11;
        setScale(computeScaleLabel({ lat: center?.lat ?? -32, zoom, barWidthPx }));
      } catch {
        /* mock */
      }
    };

    updateScale();
    map.on?.('moveend', updateScale);
    map.on?.('zoomend', updateScale);

    return () => {
      map.off?.('moveend', updateScale);
      map.off?.('zoomend', updateScale);
    };
  }, [barWidthPx, map]);

  const segments = 2;
  const segmentW = Math.max(8, Math.round(scale.barPx / segments));
  const renderedBarWidth = segmentW * segments;
  const middleLabel = formatScaleLabel(scale.distanceMeters / 2);

  return (
    <div
      className={[
        'export-map-chrome',
        compact ? 'export-map-chrome--compact' : '',
      ].filter(Boolean).join(' ')}
      data-testid="export-map-chrome"
      style={compactChromeStyle}
    >
      <MovableControl
        kind="north"
        position={resolvedNorthPosition}
        sizePx={resolvedNorthSize}
        anchor={chromeAnchor}
        onChange={onChromeChange}
      >
        <img
          src={EXPORT_NORTH_PATH}
          alt="Norte"
          className="export-north-arrow"
          data-testid="export-north-arrow"
          draggable={false}
        />
      </MovableControl>
      <MovableControl
        kind="scale"
        position={resolvedScalePosition}
        sizePx={barWidthPx}
        anchor={chromeAnchor}
        onChange={onChromeChange}
      >
        <div
          className={`export-scale-bar export-scale-bar--graphic${compact ? ' export-scale-bar--compact' : ''}`}
          data-testid="export-scale-bar"
          role="img"
          aria-label={`Escala ${scale.label}`}
        >
          <GraphicScaleControl map={map} maxWidth={barWidthPx} compact={compact}>
            <div className="export-scale-bar__ticks" style={{ width: `${renderedBarWidth}px` }}>
              <span>0</span>
              <span>{middleLabel}</span>
              <span>{scale.label}</span>
            </div>
            <div className="export-scale-bar__segments" style={{ width: `${renderedBarWidth}px` }}>
              {Array.from({ length: segments }).map((_, i) => (
                <span
                  key={`seg-${i}`}
                  className={`export-scale-bar__seg ${i % 2 === 0 ? 'is-light' : 'is-dark'}`}
                  style={{ width: `${segmentW}px` }}
                />
              ))}
            </div>
            {!compact ? (
              <div
                className="export-scale-bar__segments export-scale-bar__segments--lower"
                style={{ width: `${renderedBarWidth}px` }}
                aria-hidden="true"
              >
                {Array.from({ length: segments }).map((_, i) => (
                  <span
                    key={`lower-seg-${i}`}
                    className={`export-scale-bar__lower-seg ${i % 2 === 0 ? 'is-dark' : 'is-light'}`}
                    style={{ width: `${segmentW}px` }}
                  />
                ))}
              </div>
            ) : null}
          </GraphicScaleControl>
        </div>
      </MovableControl>
    </div>
  );
}

function overlaps(a, b) {
  if (!a || !b || a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function pointInRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right
    && point.y >= rect.top && point.y <= rect.bottom;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  const epsilon = 0.001;
  const onSegment = (p, q, r) => q.x >= Math.min(p.x, r.x) - epsilon
    && q.x <= Math.max(p.x, r.x) + epsilon
    && q.y >= Math.min(p.y, r.y) - epsilon
    && q.y <= Math.max(p.y, r.y) + epsilon;
  if (((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon))
    && ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon))) return true;
  if (Math.abs(o1) <= epsilon && onSegment(a, c, b)) return true;
  if (Math.abs(o2) <= epsilon && onSegment(a, d, b)) return true;
  if (Math.abs(o3) <= epsilon && onSegment(c, a, d)) return true;
  if (Math.abs(o4) <= epsilon && onSegment(c, b, d)) return true;
  return false;
}

function segmentIntersectsRect(a, b, rect) {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomRight = { x: rect.right, y: rect.bottom };
  const bottomLeft = { x: rect.left, y: rect.bottom };
  return segmentsIntersect(a, b, topLeft, topRight)
    || segmentsIntersect(a, b, topRight, bottomRight)
    || segmentsIntersect(a, b, bottomRight, bottomLeft)
    || segmentsIntersect(a, b, bottomLeft, topLeft);
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    const crosses = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function projectCoordinates(map, coordinates = []) {
  return coordinates.map(([lng, lat]) => map.latLngToContainerPoint?.([lat, lng]))
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function lineIntersectsRect(map, coordinates, rect) {
  const points = projectCoordinates(map, coordinates);
  for (let i = 1; i < points.length; i += 1) {
    if (segmentIntersectsRect(points[i - 1], points[i], rect)) return true;
  }
  return false;
}

function polygonIntersectsRect(map, rings, rect) {
  const projectedRings = (rings ?? []).map((ring) => projectCoordinates(map, ring)).filter((ring) => ring.length > 2);
  if (!projectedRings.length) return false;
  if (projectedRings.some((ring) => ring.some((point) => pointInRect(point, rect)))) return true;
  if (projectedRings.some((ring) => ring.some((point, index) => (
    index > 0 && segmentIntersectsRect(ring[index - 1], point, rect)
  )))) return true;

  const corners = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
  return corners.some((corner) => (
    pointInRing(corner, projectedRings[0])
      && !projectedRings.slice(1).some((hole) => pointInRing(corner, hole))
  ));
}

export function cartographicElementIntersectsRect(map, element, rect) {
  const geometry = parseElementGeojson(element);
  if (!geometry || !map?.latLngToContainerPoint) return false;
  const { type, coordinates } = geometry;
  if (type === 'Point') {
    const [lng, lat] = coordinates ?? [];
    if (!Number.isFinite(Number(lng)) || !Number.isFinite(Number(lat))) return false;
    const point = map.latLngToContainerPoint([lat, lng]);
    return pointInRect(point, {
      left: rect.left - 16,
      right: rect.right + 16,
      top: rect.top - 16,
      bottom: rect.bottom + 16,
    });
  }
  if (type === 'LineString') return lineIntersectsRect(map, coordinates, rect);
  if (type === 'MultiLineString') return coordinates.some((line) => lineIntersectsRect(map, line, rect));
  if (type === 'Polygon') return polygonIntersectsRect(map, coordinates, rect);
  if (type === 'MultiPolygon') return coordinates.some((polygon) => polygonIntersectsRect(map, polygon, rect));
  return false;
}

export function shouldCheckElementCollision(role) {
  return role === 'legend';
}

/** Detects chrome/legend collisions against each other and visible map features. */
export function CollisionMonitor({ elements = [], hiddenIds, onCollisionChange }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !onCollisionChange) return undefined;
    const mapEl = map.getContainer?.();
    const host = mapEl?.closest?.('.export-composition__main-map-cell') || mapEl?.parentElement;
    if (!mapEl || !host) return undefined;
    let frame = 0;
    let previous = '';

    const inspect = () => {
      frame = 0;
      const controls = [...host.querySelectorAll('[data-collision-role], .export-legend--inside')];
      const mapRect = mapEl.getBoundingClientRect();
      const mapElements = visibleElements(elements, hiddenIds);
      const collisions = [];
      controls.forEach((el) => el.removeAttribute('data-collision'));

      for (let i = 0; i < controls.length; i += 1) {
        const a = controls[i];
        const aRole = a.dataset.collisionRole || 'legend';
        for (let j = i + 1; j < controls.length; j += 1) {
          const b = controls[j];
          const bRole = b.dataset.collisionRole || 'legend';
          if (overlaps(a.getBoundingClientRect(), b.getBoundingClientRect())) {
            collisions.push(`${aRole}:${bRole}`);
            a.dataset.collision = 'true';
            b.dataset.collision = 'true';
          }
        }
        const aRect = a.getBoundingClientRect();
        const localRect = {
          left: aRect.left - mapRect.left,
          right: aRect.right - mapRect.left,
          top: aRect.top - mapRect.top,
          bottom: aRect.bottom - mapRect.top,
        };
        const coveredElements = shouldCheckElementCollision(aRole)
          ? mapElements.filter((element) => cartographicElementIntersectsRect(map, element, localRect))
          : [];
        if (coveredElements.length > 0) {
          coveredElements.forEach((element) => collisions.push(`${aRole}:element:${String(element.id)}`));
        }
      }

      const signature = [...new Set(collisions)].sort().join('|');
      if (signature !== previous) {
        previous = signature;
        onCollisionChange(signature ? signature.split('|') : []);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(inspect);
    };
    const observer = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(schedule)
      : null;
    observer?.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(host);
    map.on?.('move zoom moveend zoomend', schedule);
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      resizeObserver?.disconnect();
      map.off?.('move zoom moveend zoomend', schedule);
    };
  }, [elements, hiddenIds, map, onCollisionChange]);

  return null;
}

/**
 * Reports view moves for session (center / zoom export fidelity).
 */
export function MapViewSync({ onViewChange }) {
  useMapEvents({
    moveend: (e) => {
      const m = e.target;
      const c = m.getCenter?.();
      const z = m.getZoom?.();
      if (c && onViewChange) onViewChange({ center: { lat: c.lat, lng: c.lng }, zoom: z });
    },
    zoomend: (e) => {
      const m = e.target;
      const c = m.getCenter?.();
      const z = m.getZoom?.();
      if (c && onViewChange) onViewChange({ center: { lat: c.lat, lng: c.lng }, zoom: z });
    },
  });
  return null;
}

/**
 * Tracks basemap tile load state for export capture gate (data-tiles-ready).
 */
export function TileReadyTracker({ basemap, onReadyChange }) {
  const map = useMap();

  useEffect(() => {
    if (!map) {
      onReadyChange?.(true);
      return undefined;
    }

    let pending = 0;
    let readyTimer;
    let optimisticTimer;

    const setReady = (ready) => {
      onReadyChange?.(Boolean(ready));
    };

    const onLoading = () => {
      pending += 1;
      setReady(false);
    };

    const onLoad = () => {
      pending = Math.max(0, pending - 1);
      if (pending === 0) setReady(true);
    };

    const isTileLayer = (layer) => {
      if (!layer) return false;
      if (typeof L.TileLayer === 'function' && layer instanceof L.TileLayer) return true;
      return Boolean(layer._url || layer.options?.url);
    };

    const attach = (layer) => {
      if (!isTileLayer(layer) || typeof layer.on !== 'function') return;
      layer.on('loading', onLoading);
      layer.on('load', onLoad);
      layer.on('tileerror', onLoad);
    };

    const detach = (layer) => {
      if (!layer || typeof layer.off !== 'function') return;
      layer.off('loading', onLoading);
      layer.off('load', onLoad);
      layer.off('tileerror', onLoad);
    };

    const onLayerAdd = (e) => attach(e.layer);

    map.eachLayer?.(attach);
    map.on?.('layeradd', onLayerAdd);

    // Optimistic ready; only block while Leaflet reports tile loading.
    setReady(true);
    readyTimer = window.setTimeout(() => {
      if (pending === 0) setReady(true);
    }, 600);
    optimisticTimer = window.setTimeout(() => setReady(true), 8000);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(optimisticTimer);
      map.eachLayer?.(detach);
      map.off?.('layeradd', onLayerAdd);
    };
  }, [map, basemap, onReadyChange]);

  return null;
}

export default MapChromeOverlay;
