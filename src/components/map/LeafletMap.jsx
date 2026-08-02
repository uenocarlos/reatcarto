import React, { useEffect, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents, useMap, Popup, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { getIconSvg } from './iconSvgs';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
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

const { BaseLayer } = LayersControl;

const ONLINE_BRANCO_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const ONLINE_OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ONLINE_SATELITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

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
    .leaflet-control-layers {
      border: 1px solid hsl(var(--border)) !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
      margin-right: 12px !important;
      margin-top: 72px !important;
      overflow: hidden;
    }
    .leaflet-control-layers-toggle {
      width: 48px !important;
      height: 48px !important;
      background-size: 24px 24px !important;
      background-color: hsl(var(--card)) !important;
      border-radius: 12px !important;
    }
    .leaflet-control-layers-expanded {
      padding: 12px !important;
      background: hsl(var(--card)) !important;
      color: hsl(var(--foreground)) !important;
      border: none !important;
    }
    .leaflet-control-layers-list {
      font-family: inherit !important;
      font-size: 14px !important;
    }
    .leaflet-bar {
      border: none !important;
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

function MapElements({ elements, onElementLongPress, tempLine }) {
  const handleContextMenu = (e, el) => {
    e.originalEvent.preventDefault();
    const containerPoint = e.containerPoint || { x: e.originalEvent.clientX, y: e.originalEvent.clientY };
    onElementLongPress(el, { x: containerPoint.x, y: containerPoint.y });
  };

  return (
    <>
      {elements.map((el) => {
        const geojson = JSON.parse(el.geojson);
        const style = el.style ? JSON.parse(el.style) : {};

        if (el.element_type === 'point') {
          const coords = geojson.coordinates;
          const icon = createColoredIcon(style.icon_color || '#F97316', style.icon_name, style.custom_icon_url || el.custom_icon_url);
          return (
            <Marker
              key={el.id}
              position={[coords[1], coords[0]]}
              icon={icon}
              eventHandlers={{ contextmenu: (e) => handleContextMenu(e, el) }}
            >
              {el.name && <Popup><strong>{el.name}</strong>{el.description && <p className="text-xs mt-1">{el.description}</p>}</Popup>}
            </Marker>
          );
        }

        if (el.element_type === 'line') {
          const coords = geojson.coordinates.map(c => [c[1], c[0]]);
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
            />
          );
        }

        if (el.element_type === 'polygon') {
          const coords = geojson.coordinates[0].map(c => [c[1], c[0]]);
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
            />
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

function MapControls({ onCenterUser }) {
  const map = useMap();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

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
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 shadow-lg bg-card border rounded-[12px]"
          onClick={handleLocationClick}
          title="Minha Localização"
        >
          <Navigation className="w-6 h-6 text-primary" />
        </Button>
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
}) {
  const [tempFreehand, setTempFreehand] = useState([]);
  const [pointByPointCoords, setPointByPointCoords] = useState([]);

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
        center={center} 
        zoom={zoom} 
        style={{ width: '100%', height: '100%' }} 
        zoomControl={false}
        attributionControl={false}
      >
        <MapInstanceCapture />
        
        <LayersControl position="topright">
          <BaseLayer checked name="Mapa Branco">
            <TileLayer
              url={ONLINE_BRANCO_URL}
            />
          </BaseLayer>
          <BaseLayer name="OpenStreetMap">
            <TileLayer
              url={ONLINE_OSM_URL}
            />
          </BaseLayer>
          <BaseLayer name="Satélite">
            <TileLayer
              url={ONLINE_SATELITE_URL}
            />
          </BaseLayer>
        </LayersControl>

        {!readOnly && (
          <DrawingHandler
            activeTool={activeTool}
            drawingMode={drawingMode}
            onAddPoint={handleAddPoint}
            onFreehandMove={handleFreehandMove}
            onFreehandEnd={handleFreehandEnd}
          />
        )}
        <MapElements elements={elements} onElementLongPress={onElementLongPress} tempLine={readOnly ? null : tempFreehand} />
        
        {showOtherElements && (
          <div className="opacity-50 pointer-events-none">
            <MapElements elements={otherElements} onElementLongPress={() => {}} />
          </div>
        )}

        <PointByPointMarkers points={pointByPointCoords} />
        <PointByPointLine points={pointByPointCoords} />
        {gpsLine && <Polyline positions={gpsLine} pathOptions={{ color: '#EF4444', weight: 3, opacity: 0.8 }} />}
        
        <MapControls />
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
