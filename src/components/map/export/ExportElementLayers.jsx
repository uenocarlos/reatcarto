import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { Marker, Polyline, Polygon, useMap, useMapEvents } from 'react-leaflet';
import {
  createColoredIcon,
  getDashArray,
  iconSizeForZoom,
  parseElementGeojson,
  parseElementStyle,
  visibleElements,
} from './exportMapUtils';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ElementLabel({ position, text }) {
  return (
    <Marker
      position={position}
      icon={L.divIcon({
        html: `<div class="export-element-label">${escapeHtml(text)}</div>`,
        iconSize: [0, 0],
        iconAnchor: [-8, 12],
        className: 'export-element-label-marker export-map-feature export-map-feature--label',
      })}
      interactive={false}
    />
  );
}

export default function ExportElementLayers({ elements = [], hiddenIds, showLabels = false, zoom }) {
  const map = useMap();
  const [pointIconSize, setPointIconSize] = useState(() => iconSizeForZoom(zoom ?? map.getZoom()));

  useEffect(() => {
    const next = iconSizeForZoom(zoom ?? map.getZoom());
    setPointIconSize((prev) => (prev === next ? prev : next));
  }, [zoom, map]);

  useMapEvents({
    zoomend: () => {
      const next = iconSizeForZoom(map.getZoom());
      setPointIconSize((prev) => (prev === next ? prev : next));
    },
  });

  const visible = useMemo(
    () => visibleElements(elements, hiddenIds),
    [elements, hiddenIds],
  );

  return (
    <>
      {visible.map((el) => {
        const geojson = parseElementGeojson(el);
        if (!geojson) return null;
        const style = parseElementStyle(el);
        const label = String(el.name ?? el.label ?? '');

        if (el.element_type === 'point') {
          const coords = geojson.coordinates;
          const position = [coords[1], coords[0]];
          const icon = createColoredIcon(
            style.icon_color || '#F97316',
            style.icon_name,
            style.custom_icon_url || el.custom_icon_url,
            {
              size: pointIconSize,
              className: 'export-map-feature export-map-feature--point',
            },
          );
          return (
            <React.Fragment key={`${el.id}-s${pointIconSize}`}>
              <Marker position={position} icon={icon} interactive={false} />
              {showLabels && label ? <ElementLabel position={position} text={label} /> : null}
            </React.Fragment>
          );
        }

        if (el.element_type === 'line') {
          const coords = geojson.coordinates.map((c) => [c[1], c[0]]);
          const mid = coords[Math.floor(coords.length / 2)] ?? coords[0];
          return (
            <React.Fragment key={el.id}>
              <Polyline
                positions={coords}
                pathOptions={{
                  color: style.color || '#F97316',
                  opacity: (style.opacity || 100) / 100,
                  weight: style.weight || 3,
                  dashArray: getDashArray(style.dash_style),
                  className: 'export-map-feature export-map-feature--line',
                }}
                interactive={false}
              />
              {showLabels && label && mid ? <ElementLabel position={mid} text={label} /> : null}
            </React.Fragment>
          );
        }

        if (el.element_type === 'polygon') {
          const coords = geojson.coordinates[0].map((c) => [c[1], c[0]]);
          const mid = coords[Math.floor(coords.length / 2)] ?? coords[0];
          return (
            <React.Fragment key={el.id}>
              <Polygon
                positions={coords}
                pathOptions={{
                  color: style.border_color || '#F97316',
                  opacity: (style.border_opacity || 100) / 100,
                  weight: style.border_weight || 2,
                  dashArray: getDashArray(style.border_dash),
                  fillColor: style.fill_color || '#FED7AA',
                  fillOpacity: (style.fill_opacity || 40) / 100,
                  className: 'export-map-feature export-map-feature--polygon',
                }}
                interactive={false}
              />
              {showLabels && label && mid ? <ElementLabel position={mid} text={label} /> : null}
            </React.Fragment>
          );
        }

        return null;
      })}
    </>
  );
}
