/**
 * Gera public/geo/municipios-search-index.json a partir das malhas por UF.
 * Uso: node scripts/build-municipios-search-index.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const municipiosDir = path.join(root, 'public', 'geo', 'municipios');
const outPath = path.join(root, 'public', 'geo', 'municipios-search-index.json');

const UF_FILES = [
  'ac', 'al', 'am', 'ap', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mg', 'ms', 'mt',
  'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn', 'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to',
];

function walkCoords(coords, visit) {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    visit(coords[0], coords[1]);
    return;
  }
  for (const child of coords) walkCoords(child, visit);
}

function boundsAndCentroid(geometry) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let sumLng = 0;
  let sumLat = 0;
  let n = 0;

  walkCoords(geometry?.coordinates, (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
    sumLng += lng;
    sumLat += lat;
    n += 1;
  });

  if (n === 0) return null;
  return {
    lat: sumLat / n,
    lng: sumLng / n,
    // Leaflet [[south, west], [north, east]]
    bbox: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
  };
}

function featureToEntry(feature) {
  const props = feature?.properties || {};
  const name = String(props.NM_MUN ?? props.nome ?? props.name ?? '').trim();
  const uf = String(props.SIGLA_UF ?? props.uf ?? props.sigla ?? '').trim().toUpperCase();
  const code = String(props.CD_MUN ?? props.id ?? props.code ?? '').trim();
  if (!name || !uf) return null;
  const geo = boundsAndCentroid(feature.geometry);
  if (!geo) return null;
  return {
    code: code || `${uf}:${name}`,
    name,
    uf,
    state: String(props.NM_UF ?? '').trim(),
    lat: Number(geo.lat.toFixed(6)),
    lng: Number(geo.lng.toFixed(6)),
    bbox: [
      [Number(geo.bbox[0][0].toFixed(6)), Number(geo.bbox[0][1].toFixed(6))],
      [Number(geo.bbox[1][0].toFixed(6)), Number(geo.bbox[1][1].toFixed(6))],
    ],
  };
}

const entries = [];
const seen = new Set();

for (const fileId of UF_FILES) {
  const filePath = path.join(municipiosDir, `${fileId}.geojson`);
  if (!fs.existsSync(filePath)) {
    console.warn(`skip missing ${fileId}.geojson`);
    continue;
  }
  const expectedUf = fileId.toUpperCase();
  process.stdout.write(`indexing ${fileId}... `);
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const features = Array.isArray(data?.features) ? data.features : [];
  let added = 0;
  let skippedWrongUf = 0;
  for (const feature of features) {
    const entry = featureToEntry(feature);
    if (!entry) continue;
    if (entry.uf !== expectedUf) {
      skippedWrongUf += 1;
      continue;
    }
    const key = entry.code || `${entry.uf}:${entry.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
    added += 1;
  }
  const wrongNote = skippedWrongUf ? ` (ignored ${skippedWrongUf} wrong UF)` : '';
  console.log(`${added} municípios${wrongNote}`);
}

// DF bundle no repositório está corrompido (cópia de MG). Garante Brasília.
if (!entries.some((e) => e.uf === 'DF')) {
  entries.push({
    code: '5300108',
    name: 'Brasília',
    uf: 'DF',
    state: 'Distrito Federal',
    lat: -15.793889,
    lng: -47.882778,
    bbox: [
      [-16.05, -48.29],
      [-15.5, -47.3],
    ],
  });
  console.log('added fallback Brasília (DF)');
}

entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.uf.localeCompare(b.uf));

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  count: entries.length,
  municipalities: entries,
};

fs.writeFileSync(outPath, JSON.stringify(payload));
const sizeMb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${outPath} (${entries.length} entries, ${sizeMb} MB)`);
