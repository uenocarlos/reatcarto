/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function slugifyExportName(value, fallback = 'mapa') {
  const slug = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80);
  return slug || fallback;
}

/**
 * @param {unknown} [date]
 * @returns {string}
 */
export function formatExportDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return formatExportDate(new Date());
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} mapName
 * @param {'geojson'|'zip'|'shp'} format
 * @param {{ date?: Date|string|number }} [options]
 */
export function buildGisExportFileName(mapName, format, options = {}) {
  const slug = slugifyExportName(mapName);
  const date = formatExportDate(options.date);
  const ext = format === 'geojson' ? 'geojson' : 'zip';
  return `${slug}-${date}.${ext}`;
}
