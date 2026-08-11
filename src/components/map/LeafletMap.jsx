import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getIconSvg } from './iconSvgs';
import { Button } from '@/components/ui/button';
import { Navigation, Undo2, Redo2 } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import ElementPopup from './ElementPopup';
import ElementLayersPanel from './ElementLayersPanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Persiste a vista do mapa após pan/zoom (debounce no pai). */
function MapViewPersistence({ enabled = false, onViewChange }) {
  const map = useMap();
  const callbackRef = useRef(onViewChange);
  callbackRef.current = onViewChange;

  useMapEvents({
    moveend: () => {
      if (!enabled || !callbackRef.current) return;
      const c = map.getCenter();
      const z = map.getZoom();
      callbackRef.current({ lat: c.lat, lng: c.lng, zoom: z });
    },
    zoomend: () => {
      if (!enabled || !callbackRef.current) return;
      const c = map.getCenter();
      const z = map.getZoom();
      callbackRef.current({ lat: c.lat, lng: c.lng, zoom: z });
    },
  });

  return null;
}

const BASEMAP_URLS = {
  branco: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  satelite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

const createColoredIcon = (color, iconName, customUrl) => {
  const url = customUrl || (iconName && (iconName.startsWith('/') || iconName.startsWith('http') || iconName.endsWith('.svg')) ? iconName : null);
  
  if (url) {
    // If it's a URL (custom or folder icon), use the mask technique to force color
    return L.divIcon({
      html: `<div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
               <div style="
                 width: 28px; 
                 height: 28px; 
                 background-color: ${color || '#F97316'};
                 mask-image: url(${url});
                 -webkit-mask-image: url(${url});
                 mask-size: contain;
                 -webkit-mask-size: contain;
                 mask-repeat: no-repeat;
                 -webkit-mask-repeat: no-repeat;
                 mask-position: center;
                 -webkit-mask-position: center;
                 filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.3));
               "></div>
             </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32], // Anchor at bottom center for markers
      popupAnchor: [0, -32],
      className: '',
    });
  }
  
  const svg = getIconSvg(iconName || 'pin', color || '#F97316');
  
  // For pin, anchor at bottom center; for others, center
  const isPinLike = !iconName || iconName === 'pin' || iconName === 'flag';
  return L.divIcon({
    html: `<div style="filter:drop-shadow(1px 1px 2px rgba(0,0,0,0.3))">${svg}</div>`,
    iconSize: [32, 32],
    iconAnchor: isPinLike ? [16, 32] : [16, 16],
    popupAnchor: [0, -16],
    className: '',
  });
};

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

const vertexIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#fff;border:2.5px solid #F97316;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:move"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
});

/** Closed polygon rings repeat the first vertex at the end — omit duplicate handle. */
function editableRingIndexes(ring) {
  if (!ring || ring.length === 0) return [];
  const last = ring.length - 1;
  if (last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]) {
    return Array.from({ length: last }, (_, i) => i);
  }
  return Array.from({ length: ring.length }, (_, i) => i);
}

function isClosedRing(ring) {
  if (!ring || ring.length < 2) return false;
  const last = ring.length - 1;
  return ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1];
}

/**
 * Line/polygon editor: updates path live via Leaflet API (no React re-render mid-drag)
 * so the shape follows the vertex as the user moves it.
 */
function EditableShape({ element, type, style, onGeometryChange, onContextMenu }) {
  const geojson = JSON.parse(element.geojson);
  const baseLngLat = type === 'line' ? geojson.coordinates : geojson.coordinates[0];
  const closed = type === 'polygon' && isClosedRing(baseLngLat);
  const vertexIndexes = type === 'polygon' ? editableRingIndexes(baseLngLat) : baseLngLat.map((_, i) => i);

  const pathRef = useRef(null);
  const coordsRef = useRef(baseLngLat.map((c) => [c[0], c[1]]));

  useEffect(() => {
    const g = JSON.parse(element.geojson);
    const next = type === 'line' ? g.coordinates : g.coordinates[0];
    coordsRef.current = next.map((c) => [c[0], c[1]]);
    const layer = pathRef.current;
    if (layer) {
      const latlngs = next.map((c) => [c[1], c[0]]);
      layer.setLatLngs(type === 'polygon' ? [latlngs] : latlngs);
    }
  }, [element.geojson, type]);

  const applyVertex = (index, latlng, commit) => {
    const next = coordsRef.current.map((c, i) =>
      i === index ? [latlng.lng, latlng.lat] : [c[0], c[1]]
    );
    if (closed && (index === 0 || index === next.length - 1)) {
      next[0] = [latlng.lng, latlng.lat];
      next[next.length - 1] = [latlng.lng, latlng.lat];
    }
    coordsRef.current = next;

    const layer = pathRef.current;
    if (layer) {
      const latlngs = next.map((c) => [c[1], c[0]]);
      layer.setLatLngs(type === 'polygon' ? [latlngs] : latlngs);
    }

    if (commit) {
      if (type === 'line') {
        onGeometryChange?.({ type: 'LineString', coordinates: next });
      } else {
        onGeometryChange?.({ type: 'Polygon', coordinates: [next] });
      }
    }
  };

  const positions = baseLngLat.map((c) => [c[1], c[0]]);
  const pathOptions =
    type === 'line'
      ? {
          color: style.color || '#F97316',
          opacity: (style.opacity || 100) / 100,
          weight: style.weight || 3,
          dashArray: getDashArray(style.dash_style),
        }
      : {
          color: style.border_color || '#F97316',
          opacity: (style.border_opacity || 100) / 100,
          weight: style.border_weight || 2,
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
    </>
  );
}

function MapElements({ elements, onElementLongPress, tempLine, editingElementId, onGeometryChange }) {
  const handleContextMenu = (e, el) => {
    e.originalEvent.preventDefault();
    const containerPoint = e.containerPoint || { x: e.originalEvent.clientX, y: e.originalEvent.clientY };
    onElementLongPress?.(el, { x: containerPoint.x, y: containerPoint.y });
  };

  return (
    <>
      {elements.map((el) => {
        const geojson = JSON.parse(el.geojson);
        const style = el.style ? JSON.parse(el.style) : {};
        const isEditing = editingElementId != null && String(el.id) === String(editingElementId);
        const popup = !isEditing ? <ElementPopup element={el} /> : null;

        if (el.element_type === 'point') {
          const coords = geojson.coordinates;
          const icon = createColoredIcon(style.icon_color || '#F97316', style.icon_name, style.custom_icon_url || el.custom_icon_url);
          return (
            <Marker
              key={el.id}
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
        <Polyline positions={tempLine} pathOptions={{ color: '#F97316', weight: 2, dashArray: '5 5', opacity: 0.7 }} />
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
  return <Polyline positions={points} pathOptions={{ color: '#F97316', weight: 2, dashArray: '5 5', opacity: 0.7 }} />;
}

function PointByPointMarkers({ points }) {
  if (!points || points.length === 0) return null;
  return points.map((p, i) => (
    <Marker key={`temp-${i}`} position={p} icon={L.divIcon({
      html: `<div style="width:8px;height:8px;background:#F97316;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
      iconSize: [8, 8], iconAnchor: [4, 4], className: ''
    })} />
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
  basemap,
  onBasemapChange,
}) {
  const map = useMap();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  const handleLocationClick = () => {
    setShowLocationPrompt(true);
  };

  const confirmLocation = async () => {
    setShowLocationPrompt(false);
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true
      });
      map.flyTo([pos.coords.latitude, pos.coords.longitude], 16);
    } catch (e) {
      console.error(e);
      // Fallback to leaflet's native locate if capacitor fails or isn't available
      map.locate({ setView: true, maxZoom: 16 });
    }
  };

  return (
    <>
      {historyEnabled ? (
        <div
          ref={bindLeafletControlEvents}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-2"
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
        className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 items-end"
      >
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 shadow-lg bg-card border rounded-[12px]"
          onClick={handleLocationClick}
          title="Minha Localização"
        >
          <Navigation className="w-6 h-6 text-primary" />
        </Button>

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

      <AlertDialog open={showLocationPrompt} onOpenChange={setShowLocationPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usar Localização?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja usar sua localização atual para navegar no mapa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLocation}>Sim, usar GPS</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
}) {
  const [tempFreehand, setTempFreehand] = useState([]);
  const [pointByPointCoords, setPointByPointCoords] = useState([]);
  const [internalBasemap, setInternalBasemap] = useState('branco');
  const [internalHiddenIds, setInternalHiddenIds] = useState(() => new Set());
  const hiddenIds = controlledHiddenIds ?? internalHiddenIds;
  const setHiddenIds = onHiddenIdsChange ?? setInternalHiddenIds;
  const basemap = controlledBasemap ?? internalBasemap;
  const setBasemap = onBasemapChange ?? setInternalBasemap;
  const basemapUrl = BASEMAP_URLS[basemap] || BASEMAP_URLS.branco;

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
        style={{ width: '100%', height: '100%' }} 
        zoomControl={false}
        attributionControl={false}
      >
        <MapInstanceCapture />
        <MapViewPersistence enabled={!readOnly && !!onViewChange} onViewChange={onViewChange} />

        <TileLayer key={basemap} url={basemapUrl} />

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
          elements={elements}
          hiddenIds={hiddenIds}
          onHiddenIdsChange={setHiddenIds}
          basemap={basemap}
          onBasemapChange={setBasemap}
        />
      </MapContainer>

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
