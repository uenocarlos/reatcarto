import L from 'leaflet';
import { getIconSvg } from './iconSvgs';
import { resolveApiAssetUrl } from '@/api/http';

/**
 * Discrete point-icon size (px) for cartographic zoom bands.
 * Far zoom → smaller markers so polygons stay readable.
 * @param {number} zoom
 * @returns {14|18|24|32}
 */
export function iconSizeForZoom(zoom) {
  const z = Number(zoom);
  if (!Number.isFinite(z) || z <= 10) return 14;
  if (z <= 12) return 18;
  if (z <= 15) return 24;
  return 32;
}

function escapeAttr(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function isIconPath(name) {
  if (!name) return false;
  const s = String(name);
  return s.startsWith('/') || s.startsWith('http') || s.endsWith('.svg');
}

/**
 * @param {string} color
 * @param {string} [iconName]
 * @param {string} [customUrl]
 * @param {{ size?: number, zoom?: number, className?: string, withPopupAnchor?: boolean }} [options]
 */
export function createColoredIcon(color, iconName, customUrl, options = {}) {
  const size = Number.isFinite(options.size)
    ? options.size
    : iconSizeForZoom(options.zoom);
  const maskSize = Math.max(1, Math.round(size * 0.875));
  const half = size / 2;
  const className = options.className ?? '';
  const withPopupAnchor = options.withPopupAnchor === true;

  const custom = resolveApiAssetUrl(customUrl);

  if (custom) {
    const src = escapeAttr(custom);
    return L.divIcon({
      html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:transparent;">
               <img src="${src}" alt="" style="width:100%;height:100%;object-fit:contain;display:block;"
                 onerror="this.onerror=null;this.style.visibility='hidden';" />
             </div>`,
      iconSize: [size, size],
      iconAnchor: [half, half],
      ...(withPopupAnchor ? { popupAnchor: [0, -half] } : {}),
      className,
    });
  }

  const iconPathUrl = isIconPath(iconName) ? resolveApiAssetUrl(iconName) : null;

  if (iconPathUrl) {
    const url = escapeAttr(iconPathUrl);
    return L.divIcon({
      html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;">
               <div style="
                 width:${maskSize}px;height:${maskSize}px;background-color:${color || '#F97316'};
                 mask-image:url(${url});-webkit-mask-image:url(${url});
                 mask-size:contain;-webkit-mask-size:contain;
                 mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;
                 mask-position:center;-webkit-mask-position:center;
                 filter:drop-shadow(1px 1px 1px rgba(0,0,0,0.3));
               "></div>
             </div>`,
      iconSize: [size, size],
      iconAnchor: [half, size],
      ...(withPopupAnchor ? { popupAnchor: [0, -size] } : {}),
      className,
    });
  }

  const svg = getIconSvg(iconName || 'pin', color || '#F97316', size);
  const isPinLike = !iconName || iconName === 'pin' || iconName === 'flag';
  return L.divIcon({
    html: `<div style="filter:drop-shadow(1px 1px 2px rgba(0,0,0,0.3))">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: isPinLike ? [half, size] : [half, half],
    ...(withPopupAnchor ? { popupAnchor: [0, isPinLike ? -size : -half] } : {}),
    className,
  });
}
