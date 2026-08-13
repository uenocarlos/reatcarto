// SVG paths for each icon name — size is applied via width/height; viewBox stays 24×24
export const ICON_SVGS = {
  pin: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${size}" height="${size}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  circle: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`,
  square: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><rect x="3" y="3" width="18" height="18" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`,
  triangle: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><polygon points="12,2 22,22 2,22" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`,
  star: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="${color}" stroke="white" stroke-width="1"/></svg>`,
  heart: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="${color}" stroke="white" stroke-width="1"/></svg>`,
  flag: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="${color}" stroke="white" stroke-width="1"/><line x1="4" y1="22" x2="4" y2="15" stroke="${color}" stroke-width="2"/></svg>`,
  home: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="${color}" stroke="white" stroke-width="1"/><polyline points="9,22 9,12 15,12 15,22" fill="white" stroke="white" stroke-width="0.5"/></svg>`,
  anchor: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><circle cx="12" cy="5" r="3" fill="none" stroke="${color}" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="22" stroke="${color}" stroke-width="2"/><path d="M5 15l7 7 7-7" fill="none" stroke="${color}" stroke-width="2"/><line x1="5" y1="12" x2="19" y2="12" stroke="${color}" stroke-width="2"/></svg>`,
  camera: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="white" stroke-width="1"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  tree: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="white" stroke-width="1"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>`,
  car: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="white" stroke-width="1"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42.99L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`,
  alert: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="white" stroke-width="1"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
  info: (color, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="white" stroke-width="1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
};

/**
 * @param {string} iconName
 * @param {string} color
 * @param {number} [size=32] — legend may pass 24 for stable symbol size
 */
export const getIconSvg = (iconName, color, size = 32) => {
  // If it's a path to a file (starts with / or http), it's not an internal SVG
  if (iconName && (iconName.startsWith('/') || iconName.startsWith('http') || iconName.endsWith('.svg'))) {
    return null;
  }
  const fn = ICON_SVGS[iconName] || ICON_SVGS.pin;
  return fn(color, size);
};
