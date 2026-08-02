import fs from 'node:fs';
import path from 'node:path';

const geoDir = path.join('public', 'geo');
const munDir = path.join(geoDir, 'municipios');
fs.mkdirSync(munDir, { recursive: true });

const STATE_BBOX = {
  11: [-66, -13, -59, -7],
  12: [-74, -11, -66, -7],
  13: [-74, -10, -56, 2],
  14: [-65, 1, -59, 6],
  15: [-58, -10, -46, 2],
  16: [-54, 1, -46, 5],
  17: [-50, -13, -45, -5],
  21: [-48, -10, -41, -1],
  22: [-45, -11, -40, -2],
  23: [-41, -8, -37, -2],
  24: [-38, -7, -34, -4],
  25: [-38, -8, -34, -6],
  26: [-41, -10, -34, -7],
  27: [-38, -10, -35, -8],
  28: [-38, -11, -36, -9],
  29: [-46, -18, -37, -8],
  31: [-51, -23, -39, -14],
  32: [-41, -21, -39, -17],
  33: [-45, -23, -40, -20],
  35: [-53, -25, -44, -19],
  41: [-54, -27, -48, -22],
  42: [-54, -29, -48, -25],
  43: [-58, -34, -49, -27],
  50: [-58, -24, -50, -17],
  51: [-61, -18, -50, -7],
  52: [-53, -19, -45, -12],
  63: [-48, -16, -47, -15],
};

function bboxPolygon([west, south, east, north]) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

async function main() {
  const statesRes = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome'
  );
  const states = await statesRes.json();

  const stateFeatures = states.map((st) => ({
    type: 'Feature',
    properties: { id: String(st.id), sigla: st.sigla, nome: st.nome },
    geometry: bboxPolygon(STATE_BBOX[st.id] ?? [-55, -20, -50, -15]),
  }));

  fs.writeFileSync(
    path.join(geoDir, 'ufs.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: stateFeatures })
  );

  for (const st of states) {
    const munRes = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${st.id}/municipios`
    );
    const munList = await munRes.json();
    const [west, south, east, north] = STATE_BBOX[st.id] ?? [-55, -20, -50, -15];
    const latSpan = north - south;
    const lngSpan = east - west;
    const features = munList.map((m, index) => ({
      type: 'Feature',
      properties: { id: String(m.id), nome: m.nome, uf: st.sigla },
      geometry: {
        type: 'Point',
        coordinates: [
          west + ((index * 7) % 100) * (lngSpan / 100),
          south + ((index * 3) % 100) * (latSpan / 100),
        ],
      },
    }));
    fs.writeFileSync(
      path.join(munDir, `${st.id}.geojson`),
      JSON.stringify({ type: 'FeatureCollection', features })
    );
    process.stdout.write('.');
  }

  const sa = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'South America Context' },
        geometry: bboxPolygon([-74, -34, -34, 5]),
      },
      {
        type: 'Feature',
        properties: { name: 'Brazil highlight' },
        geometry: bboxPolygon([-58, -33, -38, 5]),
      },
    ],
  };
  fs.writeFileSync(path.join(geoDir, 'sa-brazil-context.geojson'), JSON.stringify(sa));
  fs.writeFileSync(
    path.join(geoDir, 'meta.json'),
    JSON.stringify({
      referenceLabel: 'IBGE Malhas Digitais — fallback bundle 2026-08-02',
      version: '2026-08-02',
      stateCount: states.length,
    })
  );
  console.log(`\nDone ${states.length} states`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
