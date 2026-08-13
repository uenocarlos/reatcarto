export { createColoredIcon, iconSizeForZoom } from '../pointIcon';

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
