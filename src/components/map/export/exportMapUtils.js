import L from 'leaflet';
import { getIconSvg } from '../iconSvgs';

export function parseElementGeojson(element) {
  if (!element?.geojson) return null;
  if (typeof element.geojson === 'object') return element.geojson;
  try {
    return JSON.parse(element.geojson);
  } catch {
    return null;
  }
}

export function parseElementStyle(element) {
  if (element?.style && typeof element.style === 'object') return element.style;
  if (typeof element?.style === 'string') {
    try {
      return JSON.parse(element.style);
    } catch {
      return {};
    }
  }
  return {};
}

export function getDashArray(style) {
  if (style === 'dashed') return '10 10';
  if (style === 'dash-dot') return '15 5 2 5';
  return null;
}

export function createColoredIcon(color, iconName, customUrl) {
  const url = customUrl || (iconName && (iconName.startsWith('/') || iconName.startsWith('http') || iconName.endsWith('.svg')) ? iconName : null);

  if (url) {
    return L.divIcon({
      html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
               <div style="
                 width:28px;height:28px;background-color:${color || '#F97316'};
                 mask-image:url(${url});-webkit-mask-image:url(${url});
                 mask-size:contain;-webkit-mask-size:contain;
                 mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;
                 mask-position:center;-webkit-mask-position:center;
                 filter:drop-shadow(1px 1px 1px rgba(0,0,0,0.3));
               "></div>
             </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      className: 'export-map-feature export-map-feature--point',
    });
  }

  const svg = getIconSvg(iconName || 'pin', color || '#F97316');
  const isPinLike = !iconName || iconName === 'pin' || iconName === 'flag';
  return L.divIcon({
    html: `<div style="filter:drop-shadow(1px 1px 2px rgba(0,0,0,0.3))">${svg}</div>`,
    iconSize: [32, 32],
    iconAnchor: isPinLike ? [16, 32] : [16, 16],
    className: 'export-map-feature export-map-feature--point',
  });
}

export function visibleElements(elements, hiddenIds) {
  const hidden = hiddenIds instanceof Set
    ? hiddenIds
    : new Set(Array.isArray(hiddenIds) ? hiddenIds : []);
  return (elements ?? []).filter(
    (el) => el?.is_publicly_visible !== false
      && el?.is_publicly_visible !== 0
      && !hidden.has(String(el.id)),
  );
}
