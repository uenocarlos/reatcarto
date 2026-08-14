import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { EXPORT_COORD_PRECISION, EXPORT_STYLE_KEYS } from './constants';

const DOWNLOAD_FRAME_ID = 'reatcarto-download-frame';
const EXPORT_DIR = 'reatcarto-exports';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(blob);
  });
}

function isShareCanceled(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('cancel') || error?.code === 'SHARE_CANCELED';
}

async function shareNativeFile(blob, fileName) {
  const data = await blobToBase64(blob);
  try {
    await Filesystem.mkdir({
      path: EXPORT_DIR,
      directory: Directory.Cache,
      recursive: true,
    });
  } catch {
    /* already exists */
  }
  const path = `${EXPORT_DIR}/${fileName}`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data,
  });
  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });
  try {
    await Share.share({
      title: fileName,
      files: [uri],
      dialogTitle: fileName,
    });
  } catch (error) {
    if (isShareCanceled(error)) return;
    throw error;
  }
}

const SIMPLE_GEOMETRY_TYPES = new Set([
  'Point',
  'LineString',
  'Polygon',
  'MultiPoint',
  'MultiLineString',
  'MultiPolygon',
]);

export class GisExportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GisExportError';
    this.code = code;
  }
}

export function parseJsonValue(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function parseElementStyle(element) {
  const style = parseJsonValue(element?.style, {});
  return style && typeof style === 'object' && !Array.isArray(style) ? style : {};
}

export function parseElementGeometry(element) {
  const decoded = parseJsonValue(element?.geojson, null);
  if (!decoded || typeof decoded !== 'object') return null;

  const geometry = decoded.type === 'Feature' ? decoded.geometry : decoded;
  if (!geometry || typeof geometry !== 'object') return null;
  if (!SIMPLE_GEOMETRY_TYPES.has(geometry.type)) return null;
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return null;
  return geometry;
}

function roundNumber(value, precision) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function roundCoordinates(coordinates, precision = EXPORT_COORD_PRECISION) {
  if (!Array.isArray(coordinates)) return coordinates;
  if (coordinates.length >= 2 && typeof coordinates[0] === 'number') {
    return coordinates.map((value, index) => (
      index < 2 && typeof value === 'number' ? roundNumber(value, precision) : value
    ));
  }
  return coordinates.map((item) => roundCoordinates(item, precision));
}

export function roundGeometry(geometry, precision = EXPORT_COORD_PRECISION) {
  if (!geometry) return geometry;
  return {
    ...geometry,
    coordinates: roundCoordinates(geometry.coordinates, precision),
  };
}

export function buildFeatureProperties(element) {
  const style = parseElementStyle(element);
  /** @type {Record<string, string|number|boolean>} */
  const properties = {
    name: element?.name == null ? '' : String(element.name),
    description: element?.description == null ? '' : String(element.description),
    category: element?.element_category == null ? '' : String(element.element_category),
  };

  for (const key of EXPORT_STYLE_KEYS) {
    if (!(key in style)) continue;
    const value = style[key];
    if (value == null || typeof value === 'object') continue;
    properties[key] = value;
  }

  return properties;
}

export function elementToFeature(element) {
  const geometry = parseElementGeometry(element);
  if (!geometry) return null;
  return {
    type: 'Feature',
    geometry: roundGeometry(geometry),
    properties: buildFeatureProperties(element),
  };
}

/**
 * @param {object[]} elements
 * @param {{
 *   elementIds?: Array<string|number>|null,
 *   preparedMapIncomplete?: boolean,
 * }} [options]
 */
export function buildFeatureCollection(elements = [], options = {}) {
  const idFilter = options.elementIds
    ? new Set(options.elementIds.map((id) => String(id)))
    : null;
  const features = [];
  const warnings = [];

  for (const element of elements) {
    if (idFilter && !idFilter.has(String(element?.id))) continue;
    const feature = elementToFeature(element);
    if (!feature) {
      if (element?.id != null) {
        warnings.push({ id: String(element.id), reason: 'invalid_geometry' });
      }
      continue;
    }
    features.push(feature);
  }

  return {
    type: 'FeatureCollection',
    features,
    warnings,
    incompleteWarning: options.preparedMapIncomplete === true,
  };
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 * @param {{
 *   createObjectURL?: (blob: Blob) => string,
 *   revokeObjectURL?: (url: string) => void,
 *   documentRef?: Document,
 *   isNative?: () => boolean,
 *   shareNative?: (blob: Blob, fileName: string) => Promise<void>,
 * }} [deps]
 */
export async function triggerDownload(blob, fileName, deps = {}) {
  const isNative = deps.isNative ?? (() => Capacitor.isNativePlatform());
  if (isNative()) {
    try {
      const shareNative = deps.shareNative ?? shareNativeFile;
      await shareNative(blob, fileName);
      return;
    } catch (error) {
      const wrapped = new GisExportError(
        'storage_error',
        error?.message || 'Não foi possível salvar o arquivo no dispositivo.',
      );
      wrapped.cause = error;
      throw wrapped;
    }
  }

  const doc = deps.documentRef ?? (typeof document !== 'undefined' ? document : null);
  const createObjectURL = deps.createObjectURL
    ?? (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL.bind(URL)
      : null);
  const revokeObjectURL = deps.revokeObjectURL
    ?? (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function'
      ? URL.revokeObjectURL.bind(URL)
      : () => {});
  if (!doc || !createObjectURL) {
    throw new GisExportError('storage_error', 'Download API indisponível.');
  }

  let url;
  try {
    url = createObjectURL(blob);
  } catch (error) {
    const wrapped = new GisExportError(
      'storage_error',
      error?.message || 'Não foi possível preparar o arquivo para download.',
    );
    wrapped.cause = error;
    throw wrapped;
  }

  let frame = doc.getElementById(DOWNLOAD_FRAME_ID);
  if (!frame) {
    frame = doc.createElement('iframe');
    frame.id = DOWNLOAD_FRAME_ID;
    frame.name = DOWNLOAD_FRAME_ID;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.display = 'none';
    doc.body.appendChild(frame);
  }

  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  // If the UA ignores `download` (common in WebViews), keep the blob out of the app window.
  anchor.target = DOWNLOAD_FRAME_ID;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => revokeObjectURL(url), 2000);
}

/**
 * @param {object} collection FeatureCollection
 * @param {string} fileName
 * @param {object} [deps]
 */
export async function exportGeoJsonToFile(collection, fileName, deps = {}) {
  const payload = {
    type: 'FeatureCollection',
    features: collection?.features ?? [],
  };
  let json;
  try {
    json = JSON.stringify(payload, null, 2);
  } catch (error) {
    throw new GisExportError('invalid_geojson', error?.message || 'Falha ao serializar GeoJSON.');
  }

  const BlobImpl = deps.BlobImpl ?? (typeof Blob !== 'undefined' ? Blob : null);
  if (!BlobImpl) {
    throw new GisExportError('storage_error', 'Blob API indisponível.');
  }

  const blob = new BlobImpl([json], { type: 'application/geo+json' });
  await triggerDownload(blob, fileName, deps);
  return { fileName, mimeType: 'application/geo+json', blob };
}
