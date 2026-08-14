import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Undo2, Redo2 } from 'lucide-react';
import ElementPopup from './ElementPopup';
import ElementLayersPanel from './ElementLayersPanel';
import LocateMapButton from './LocateMapButton';
import { createColoredIcon, iconSizeForZoom } from './pointIcon';
import { parseElementGeojson, parseElementStyle } from './export/exportMapUtils';
import { getBasemapTileProps, MAP_MAX_ZOOM } from '@/lib/basemaps';
import { editableRingIndexes, isClosedRing, midpointHandles } from '@/lib/editableGeometry';
import { cn } from '@/lib/utils';

/** Garante que a vista inicial seja aplicada após montagem do mapa. */
function MapInitialView({ view, suppressRef }) {
  const map = useMap();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!view || appliedRef.current) return;
    appliedRef.current = true;
    const center = map.getCenter();
    const currentZoom = map.getZoom();
    const needsMove =
      Math.abs(center.lat - view.lat) > 1e-5 ||
      Math.abs(center.lng - view.lng) > 1e-5 ||
      currentZoom !== view.zoom;
    if (needsMove) {
      if (suppressRef) suppressRef.current += 1;
      map.setView([view.lat, view.lng], view.zoom, { animate: false });
      map.once('moveend', () => {
        if (suppressRef) suppressRef.current = Math.max(0, suppressRef.current - 1);
      });
    }
  }, [map, view, suppressRef]);

  return null;
}

/** Persiste a vista do mapa após pan/zoom manual (debounce no pai). */
function MapViewPersistence({
  enabled = false,
  onViewChange,
  suppressRef,
  userInteractedRef,
}) {
  const map = useMap();
  const callbackRef = useRef(onViewChange);
  callbackRef.current = onViewChange;

  useMapEvents({
    dragend: () => {
      if (userInteractedRef) userInteractedRef.current = true;
    },
    zoomend: (event) => {
      if (event.originalEvent && userInteractedRef) {
        userInteractedRef.current = true;
      }
    },
    moveend: () => {
      if (!enabled || !callbackRef.current) return;
      if (suppressRef?.current > 0) return;
      if (userInteractedRef && !userInteractedRef.current) return;
      const c = map.getCenter();
      const z = map.getZoom();
      callbackRef.current({ lat: c.lat, lng: c.lng, zoom: z });
    },
  });

  return null;
}

// Senior UI: Global CSS to unify Leaflet controls with the App's Design System
const ControlStyles = () => (
  <style>{`
    .leaflet-bar {
      border: none !important;
    }
    .element-popup .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      border: 1px solid hsl(var(--border));
      padding: 0;
    }
    .element-popup .leaflet-popup-content {
      margin: 10px 12px;
      line-height: 1.35;
    }
    .element-popup .leaflet-popup-tip {
      box-shadow: none;
    }
  `}</style>
);

const getDashArray = (style) => {
  if (style === 'dashed') return '10 10';
  if (style === 'dash-dot') return '15 5 2 5';
  return null;
};

function DrawingHandler({ activeTool, drawingMode, onAddPoint, onFreehandMove, onFreehandEnd, freehandDrawing }) {
  const map = useMap();

  useMapEvents({
    click(e) {
      if (activeTool === 'point' && drawingMode === 'manual') {
        onAddPoint([e.latlng.lat, e.latlng.lng], 'point');
      }
      if ((activeTool === 'line' || activeTool === 'polygon') && drawingMode === 'point-by-point') {
        onAddPoint([e.latlng.lat, e.latlng.lng], activeTool);
      }
    },
  });

  useEffect(() => {
    if ((activeTool === 'line' || activeTool === 'polygon') && drawingMode === 'freehand') {
      let drawing = false;
      const points = [];

      const onMouseDown = (e) => {
        drawing = true;
        points.length = 0;
        points.push([e.latlng.lat, e.latlng.lng]);
        map.dragging.disable();
      };

      const onMouseMove = (e) => {
        if (!drawing) return;
        points.push([e.latlng.lat, e.latlng.lng]);
        onFreehandMove([...points]);
      };

      const onMouseUp = () => {
        if (!drawing) return;
        drawing = false;
        map.dragging.enable();
        if (points.length > 2) {
          onFreehandEnd([...points], activeTool);
        }
      };

      // Touch events for mobile
      const onTouchStart = (e) => {
        const touch = e.touches[0];
        const latlng = map.containerPointToLatLng(L.point(touch.clientX - map.getContainer().getBoundingClientRect().left, touch.clientY - map.getContainer().getBoundingClientRect().top));
        drawing = true;
        points.length = 0;
        points.push([latlng.lat, latlng.lng]);
        map.dragging.disable();
      };

      const onTouchMove = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const touch = e.touches[0];
        const latlng = map.containerPointToLatLng(L.point(touch.clientX - map.getContainer().getBoundingClientRect().left, touch.clientY - map.getContainer().getBoundingClientRect().top));
        points.push([latlng.lat, latlng.lng]);
        onFreehandMove([...points]);
      };

      const onTouchEnd = () => {
        if (!drawing) return;
        drawing = false;
        map.dragging.enable();
        if (points.length > 2) {
          onFreehandEnd([...points], activeTool);
        }
      };

      map.on('mousedown', onMouseDown);
      map.on('mousemove', onMouseMove);
      map.on('mouseup', onMouseUp);

      const container = map.getContainer();
      container.addEventListener('touchstart', onTouchStart, { passive: false });
      container.addEventListener('touchmove', onTouchMove, { passive: false });
      container.addEventListener('touchend', onTouchEnd);

      return () => {
        map.off('mousedown', onMouseDown);
        map.off('mousemove', onMouseMove);
        map.off('mouseup', onMouseUp);
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchmove', onTouchMove);
        container.removeEventListener('touchend', onTouchEnd);
        map.dragging.enable();
      };
    }
  }, [activeTool, drawingMode, map]);

  return null;
}

const VERTEX_SIZE = 22;
const MIDPOINT_SIZE = 16;
const DRAW_VERTEX_SIZE = 18;
const DRAW_LINE_STYLE = { color: '#F97316', weight: 5, dashArray: '10 8', opacity: 0.9 };

const vertexIcon = L.divIcon({
  html: `<div style="width:${VERTEX_SIZE}px;height:${VERTEX_SIZE}px;background:#fff;border:3px solid #F97316;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:move"></div>`,
  iconSize: [VERTEX_SIZE, VERTEX_SIZE],
  iconAnchor: [VERTEX_SIZE / 2, VERTEX_SIZE / 2],
  className: '',
});

const midpointIcon = L.divIcon({
  html: `<div style="width:${MIDPOINT_SIZE}px;height:${MIDPOINT_SIZE}px;background:rgba(255,255,255,0.45);border:2.5px dashed #F97316;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:move"></div>`,
  iconSize: [MIDPOINT_SIZE, MIDPOINT_SIZE],
  iconAnchor: [MIDPOINT_SIZE / 2, MIDPOINT_SIZE / 2],
  className: '',
});

const drawVertexIcon = L.divIcon({
  html: `<div style="width:${DRAW_VERTEX_SIZE}px;height:${DRAW_VERTEX_SIZE}px;background:#F97316;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [DRAW_VERTEX_SIZE, DRAW_VERTEX_SIZE],
  iconAnchor: [DRAW_VERTEX_SIZE / 2, DRAW_VERTEX_SIZE / 2],
  className: '',
});

/**
 * Line/polygon editor: updates path live via Leaflet API (no React re-render mid-drag)
 * so the shape follows the vertex as the user moves it.
 */
function EditableShape({ element, type, style, onGeometryChange, onContextMenu }) {
  const pathRef = useRef(null);
  const coordsRef = useRef([]);
  const midpointDragRef = useRef(null);

  useEffect(() => {
    const g = parseElementGeojson(element);
    if (!g?.coordinates) return;
    const next = type === 'line' ? g.coordinates : g.coordinates[0];
    if (!Array.isArray(next)) return;
    coordsRef.current = next.map((c) => [c[0], c[1]]);
    midpointDragRef.current = null;
    const layer = pathRef.current;
    if (layer) {
      const latlngs = next.map((c) => [c[1], c[0]]);
      layer.setLatLngs(type === 'polygon' ? [latlngs] : latlngs);
    }
  }, [element.geojson, type]);

  const geojson = parseElementGeojson(element);
  if (!geojson?.coordinates) return null;
  const baseLngLat = type === 'line' ? geojson.coordinates : geojson.coordinates[0];
  if (!Array.isArray(baseLngLat)) return null;
  if (coordsRef.current.length === 0) {
    coordsRef.current = baseLngLat.map((c) => [c[0], c[1]]);
  }
  const closed = type === 'polygon' && isClosedRing(baseLngLat);
  const vertexIndexes = type === 'polygon' ? editableRingIndexes(baseLngLat) : baseLngLat.map((_, i) => i);
  const midpoints = midpointHandles(baseLngLat, closed);

  const commitGeometry = (next) => {
    if (type === 'line') {
      onGeometryChange?.({ type: 'LineString', coordinates: next });
    } else {
      onGeometryChange?.({ type: 'Polygon', coordinates: [next] });
    }
  };

  const updatePath = (next) => {
    const layer = pathRef.current;
    if (!layer) return;
    const latlngs = next.map((c) => [c[1], c[0]]);
    layer.setLatLngs(type === 'polygon' ? [latlngs] : latlngs);
  };

  const applyVertex = (index, latlng, commit) => {
    const next = coordsRef.current.map((c, i) =>
      i === index ? [latlng.lng, latlng.lat] : [c[0], c[1]]
    );
    if (closed && (index === 0 || index === next.length - 1)) {
      next[0] = [latlng.lng, latlng.lat];
      next[next.length - 1] = [latlng.lng, latlng.lat];
    }
    coordsRef.current = next;
    updatePath(next);
    if (commit) commitGeometry(next);
  };

  const applyMidpoint = (insertAt, latlng, commit) => {
    if (!midpointDragRef.current) {
      const next = coordsRef.current.map((c) => [c[0], c[1]]);
      next.splice(insertAt, 0, [latlng.lng, latlng.lat]);
      coordsRef.current = next;
      midpointDragRef.current = { index: insertAt };
    } else {
      const idx = midpointDragRef.current.index;
      coordsRef.current = coordsRef.current.map((c, i) =>
        i === idx ? [latlng.lng, latlng.lat] : [c[0], c[1]]
      );
    }
    updatePath(coordsRef.current);
    if (commit) {
      midpointDragRef.current = null;
      commitGeometry(coordsRef.current);
    }
  };

  const positions = baseLngLat.map((c) => [c[1], c[0]]);
  const pathOptions =
    type === 'line'
      ? {
          color: style.color || '#F97316',
          opacity: (style.opacity || 100) / 100,
          weight: Math.max(style.weight || 3, 5),
          dashArray: getDashArray(style.dash_style),
        }
      : {
          color: style.border_color || '#F97316',
          opacity: (style.border_opacity || 100) / 100,
          weight: Math.max(style.border_weight || 2, 4),
          dashArray: getDashArray(style.border_dash),
          fillColor: style.fill_color || '#FED7AA',
          fillOpacity: (style.fill_opacity || 40) / 100,
        };

  return (
    <>
      {type === 'line' ? (
        <Polyline
          ref={pathRef}
          positions={positions}
          pathOptions={pathOptions}
          eventHandlers={{ contextmenu: onContextMenu }}
        />
      ) : (
        <Polygon
          ref={pathRef}
          positions={positions}
          pathOptions={pathOptions}
          eventHandlers={{ contextmenu: onContextMenu }}
        />
      )}
      {vertexIndexes.map((i) => (
        <Marker
          key={`${element.id}-v-${i}`}
          position={[baseLngLat[i][1], baseLngLat[i][0]]}
          icon={vertexIcon}
          draggable
          zIndexOffset={1000}
          eventHandlers={{
            drag: (e) => applyVertex(i, e.target.getLatLng(), false),
            dragend: (e) => applyVertex(i, e.target.getLatLng(), true),
          }}
        />
      ))}
      {midpoints.map((mid) => (
        <Marker
          key={`${element.id}-m-${mid.key}`}
          position={[mid.lat, mid.lng]}
          icon={midpointIcon}
          draggable
          zIndexOffset={900}
          eventHandlers={{
            dragstart: (e) => applyMidpoint(mid.insertAt, e.target.getLatLng(), false),
            drag: (e) => applyMidpoint(mid.insertAt, e.target.getLatLng(), false),
            dragend: (e) => applyMidpoint(mid.insertAt, e.target.getLatLng(), true),
          }}
        />
      ))}
    </>
  );
}

function MapElements({ elements, onElementLongPress, tempLine, editingElementId, onGeometryChange }) {
  const map = useMap();
  const [pointIconSize, setPointIconSize] = useState(() => iconSizeForZoom(map.getZoom()));

  useMapEvents({
    zoomend: () => {
      const next = iconSizeForZoom(map.getZoom());
      setPointIconSize((prev) => (prev === next ? prev : next));
    },
  });

  const handleContextMenu = (e, el) => {
    e.originalEvent.preventDefault();
    const containerPoint = e.containerPoint || { x: e.originalEvent.clientX, y: e.originalEvent.clientY };
    onElementLongPress?.(el, { x: containerPoint.x, y: containerPoint.y });
  };

  return (
    <>
      {elements.map((el) => {
        const geojson = parseElementGeojson(el);
        const style = parseElementStyle(el);
        if (!geojson?.coordinates) return null;
        const isEditing = editingElementId != null && String(el.id) === String(editingElementId);
        const popup = !isEditing ? <ElementPopup element={el} /> : null;

        if (el.element_type === 'point') {
          const coords = geojson.coordinates;
          const icon = createColoredIcon(
            style.icon_color || '#F97316',
            style.icon_name,
            style.custom_icon_url || el.custom_icon_url,
            { size: pointIconSize, withPopupAnchor: true },
          );
          return (
            <Marker
              key={`${el.id}-s${pointIconSize}`}
              position={[coords[1], coords[0]]}
              icon={icon}
              draggable={isEditing}
              eventHandlers={{
                contextmenu: (e) => handleContextMenu(e, el),
                dragend: (e) => {
                  if (!isEditing) return;
                  const { lat, lng } = e.target.getLatLng();
                  onGeometryChange?.({ type: 'Point', coordinates: [lng, lat] });
                },
              }}
            >
              {popup}
            </Marker>
          );
        }

        if (el.element_type === 'line') {
          if (isEditing) {
            return (
              <EditableShape
                key={el.id}
                element={el}
                type="line"
                style={style}
                onGeometryChange={onGeometryChange}
                onContextMenu={(e) => handleContextMenu(e, el)}
              />
            );
          }
          const coords = geojson.coordinates.map((c) => [c[1], c[0]]);
          return (
            <Polyline
              key={el.id}
              positions={coords}
              pathOptions={{
                color: style.color || '#F97316',
                opacity: (style.opacity || 100) / 100,
                weight: style.weight || 3,
                dashArray: getDashArray(style.dash_style),
              }}
              eventHandlers={{ contextmenu: (e) => handleContextMenu(e, el) }}
            >
              {popup}
            </Polyline>
          );
        }

        if (el.element_type === 'polygon') {
          if (isEditing) {
            return (
              <EditableShape
                key={el.id}
                element={el}
                type="polygon"
                style={style}
                onGeometryChange={onGeometryChange}
                onContextMenu={(e) => handleContextMenu(e, el)}
              />
            );
          }
          const coords = geojson.coordinates[0].map((c) => [c[1], c[0]]);
          return (
            <Polygon
              key={el.id}
              positions={coords}
              pathOptions={{
                color: style.border_color || '#F97316',
                opacity: (style.border_opacity || 100) / 100,
                weight: style.border_weight || 2,
                dashArray: getDashArray(style.border_dash),
                fillColor: style.fill_color || '#FED7AA',
                fillOpacity: (style.fill_opacity || 40) / 100,
              }}
              eventHandlers={{ contextmenu: (e) => handleContextMenu(e, el) }}
            >
              {popup}
            </Polygon>
          );
        }
        return null;
      })}

      {/* Temp drawing line */}
      {tempLine && tempLine.length > 1 && (
        <Polyline positions={tempLine} pathOptions={DRAW_LINE_STYLE} />
      )}
    </>
  );
}

function PasteHandler({ enabled, onPasteAt }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onPasteAt([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function PointByPointLine({ points }) {
  if (!points || points.length < 2) return null;
  return <Polyline positions={points} pathOptions={DRAW_LINE_STYLE} />;
}

function PointByPointMarkers({ points }) {
  if (!points || points.length === 0) return null;
  return points.map((p, i) => (
    <Marker key={`temp-${i}`} position={p} icon={drawVertexIcon} zIndexOffset={1000} />
  ));
}

/** Impede que cliques/rolagem em overlays React cheguem ao mapa Leaflet (ex.: zoom no double-click). */
function bindLeafletControlEvents(el) {
  if (!el) return undefined;
  L.DomEvent.disableClickPropagation(el);
  L.DomEvent.disableScrollPropagation(el);
  return undefined;
}

function MapControls({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  historyEnabled = false,
  elements = [],
  hiddenIds,
  onHiddenIdsChange,
  layersEnabled = false,
  showLocateControl = true,
  basemap,
  onBasemapChange,
  userInteractedRef,
  onLocated,
  controlsTopClass = 'top-3',
}) {
  const map = useMap();
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <>
      {historyEnabled ? (
        <div
          ref={bindLeafletControlEvents}
          className={cn('absolute left-1/2 -translate-x-1/2 z-[1000] flex gap-2', controlsTopClass)}
        >
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11 shadow-lg bg-card border rounded-[12px] disabled:opacity-40"
            onClick={onUndo}
            disabled={!canUndo}
            title="Desfazer"
          >
            <Undo2 className="w-5 h-5 text-primary" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11 shadow-lg bg-card border rounded-[12px] disabled:opacity-40"
            onClick={onRedo}
            disabled={!canRedo}
            title="Refazer"
          >
            <Redo2 className="w-5 h-5 text-primary" />
          </Button>
        </div>
      ) : null}

      <div
        ref={bindLeafletControlEvents}
        className={cn('absolute right-3 z-[1000] flex flex-col gap-2 items-end', controlsTopClass)}
      >
        {showLocateControl ? (
          <LocateMapButton
            map={map}
            variant="map"
            userInteractedRef={userInteractedRef}
            onLocated={onLocated}
          />
        ) : null}

        {layersEnabled ? (
          <ElementLayersPanel
            elements={elements}
            hiddenIds={hiddenIds}
            onHiddenIdsChange={onHiddenIdsChange}
            open={layersOpen}
            onOpenChange={setLayersOpen}
            basemap={basemap}
            onBasemapChange={onBasemapChange}
          />
        ) : null}
      </div>
    </>
  );
}

export default function LeafletMap({ 
  center, 
  zoom, 
  elements, 
  otherElements = [], 
  showOtherElements = false, 
  activeTool, 
  drawingMode, 
  onNewElement, 
  onElementLongPress, 
  gpsPoints,
  onMapInstance,
  readOnly = false,
  editingElementId = null,
  onGeometryChange,
  pasteEnabled = false,
  onPasteAt,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  hiddenIds: controlledHiddenIds,
  onHiddenIdsChange,
  basemap: controlledBasemap,
  onBasemapChange,
  onViewChange,
  mapKey,
  initialView = null,
  suppressViewPersistenceRef = null,
  userInteractedRef = null,
  showDecorativeBorder = false,
  showLocateControl = true,
  onLocated,
  controlsTopClass = 'top-3',
}) {
  const [tempFreehand, setTempFreehand] = useState([]);
  const [pointByPointCoords, setPointByPointCoords] = useState([]);
  const [internalBasemap, setInternalBasemap] = useState('branco');
  const [internalHiddenIds, setInternalHiddenIds] = useState(() => new Set());
  const hiddenIds = controlledHiddenIds ?? internalHiddenIds;
  const setHiddenIds = onHiddenIdsChange ?? setInternalHiddenIds;
  const basemap = controlledBasemap ?? internalBasemap;
  const setBasemap = onBasemapChange ?? setInternalBasemap;
  const basemapTile = getBasemapTileProps(basemap);

  const visibleElements = useMemo(
    () => elements.filter((el) => !hiddenIds.has(String(el.id))),
    [elements, hiddenIds]
  );

  // Component to capture map instance
  const MapInstanceCapture = () => {
    const map = useMap();
    useEffect(() => {
      if (onMapInstance) onMapInstance(map);
    }, [map]);
    return null;
  };

  const handleAddPoint = (coords, type) => {
    if (type === 'point') {
      const geojson = { type: 'Point', coordinates: [coords[1], coords[0]] };
      onNewElement('point', JSON.stringify(geojson));
    } else {
      setPointByPointCoords(prev => [...prev, coords]);
    }
  };

  const handleFreehandMove = (points) => {
    setTempFreehand(points);
  };

  const handleFreehandEnd = (points, type) => {
    setTempFreehand([]);
    if (type === 'line') {
      const geojson = { type: 'LineString', coordinates: points.map(p => [p[1], p[0]]) };
      onNewElement('line', JSON.stringify(geojson));
    } else {
      const closed = [...points, points[0]];
      const geojson = { type: 'Polygon', coordinates: [closed.map(p => [p[1], p[0]])] };
      onNewElement('polygon', JSON.stringify(geojson));
    }
  };

  // Finish point-by-point
  const finishPointByPoint = useCallback(() => {
    if (pointByPointCoords.length < 2) return;
    if (activeTool === 'line') {
      const geojson = { type: 'LineString', coordinates: pointByPointCoords.map(p => [p[1], p[0]]) };
      onNewElement('line', JSON.stringify(geojson));
    } else if (activeTool === 'polygon') {
      const closed = [...pointByPointCoords, pointByPointCoords[0]];
      const geojson = { type: 'Polygon', coordinates: [closed.map(p => [p[1], p[0]])] };
      onNewElement('polygon', JSON.stringify(geojson));
    }
    setPointByPointCoords([]);
  }, [pointByPointCoords, activeTool, onNewElement]);

  // GPS tracking polyline
  const gpsLine = gpsPoints && gpsPoints.length > 1 ? gpsPoints : null;

  return (
    <div className="relative w-full h-full" style={{ minHeight: 0 }}>
      <ControlStyles />
      <MapContainer 
        key={mapKey || undefined}
        center={center} 
        zoom={zoom}
        maxZoom={MAP_MAX_ZOOM}
        style={{ width: '100%', height: '100%' }} 
        zoomControl={false}
        attributionControl={false}
      >
        <MapInstanceCapture />
        {initialView ? (
          <MapInitialView view={initialView} suppressRef={suppressViewPersistenceRef} />
        ) : null}
        <MapViewPersistence
          enabled={!readOnly && !!onViewChange}
          onViewChange={onViewChange}
          suppressRef={suppressViewPersistenceRef}
          userInteractedRef={userInteractedRef}
        />

        <TileLayer key={basemap} {...basemapTile} />

        {!readOnly && (
          <DrawingHandler
            activeTool={activeTool}
            drawingMode={drawingMode}
            onAddPoint={handleAddPoint}
            onFreehandMove={handleFreehandMove}
            onFreehandEnd={handleFreehandEnd}
          />
        )}
        {!readOnly && pasteEnabled && onPasteAt && (
          <PasteHandler enabled={pasteEnabled} onPasteAt={onPasteAt} />
        )}
        <MapElements
          elements={visibleElements}
          onElementLongPress={readOnly ? undefined : onElementLongPress}
          tempLine={readOnly ? null : tempFreehand}
          editingElementId={readOnly ? null : editingElementId}
          onGeometryChange={readOnly ? undefined : onGeometryChange}
        />
        
        {showOtherElements && (
          <div className="opacity-50 pointer-events-none">
            <MapElements elements={otherElements} onElementLongPress={() => {}} />
          </div>
        )}

        <PointByPointMarkers points={pointByPointCoords} />
        <PointByPointLine points={pointByPointCoords} />
        {gpsLine && <Polyline positions={gpsLine} pathOptions={{ color: '#EF4444', weight: 3, opacity: 0.8 }} />}
        
        <MapControls
          historyEnabled={!readOnly && !!(onUndo || onRedo)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          layersEnabled
          showLocateControl={showLocateControl}
          elements={elements}
          hiddenIds={hiddenIds}
          onHiddenIdsChange={setHiddenIds}
          basemap={basemap}
          onBasemapChange={setBasemap}
          userInteractedRef={userInteractedRef}
          onLocated={onLocated}
          controlsTopClass={controlsTopClass}
        />
      </MapContainer>

      {showDecorativeBorder ? (
        <div className="editor-map-decorative-frame" aria-hidden data-testid="editor-map-decorative-frame" />
      ) : null}

      {/* Point-by-point finish button */}
      {!readOnly && drawingMode === 'point-by-point' && pointByPointCoords.length >= 2 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000]">
          <button
            onClick={finishPointByPoint}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full shadow-lg text-sm font-medium hover:opacity-90 transition"
          >
            Finalizar {activeTool === 'line' ? 'Linha' : 'Polígono'} ({pointByPointCoords.length} pontos)
          </button>
        </div>
      )}
    </div>
  );
}
