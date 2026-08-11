const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const UTM_SCALE = 0.9996;
const UTM_FALSE_EASTING = 500000;

export class MemorialGeometryError extends Error {
  constructor(message, code = 'invalid_geometry') {
    super(message);
    this.name = 'MemorialGeometryError';
    this.code = code;
  }
}

function parseGeoJson(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) {
    throw new MemorialGeometryError('O polígono não possui geometria.');
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new MemorialGeometryError('A geometria do polígono é inválida.');
  }
}

function ringMagnitude(ring) {
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const next = (index + 1) % ring.length;
    sum += Number(ring[index]?.[0]) * Number(ring[next]?.[1]);
    sum -= Number(ring[next]?.[0]) * Number(ring[index]?.[1]);
  }
  return Math.abs(sum / 2);
}

function sameCoordinate(first, second, tolerance = 1e-10) {
  return Math.abs(first[0] - second[0]) <= tolerance
    && Math.abs(first[1] - second[1]) <= tolerance;
}

export function extractExteriorRing(elementOrGeoJson) {
  const source = elementOrGeoJson?.geojson ?? elementOrGeoJson;
  const parsed = parseGeoJson(source);
  const geometry = parsed.type === 'Feature' ? parsed.geometry : parsed;
  let ring;

  if (geometry?.type === 'Polygon') {
    ring = geometry.coordinates?.[0];
  } else if (geometry?.type === 'MultiPolygon') {
    const candidates = (geometry.coordinates ?? [])
      .map((polygon) => polygon?.[0])
      .filter((candidate) => Array.isArray(candidate) && candidate.length >= 4);
    ring = candidates.sort((left, right) => ringMagnitude(right) - ringMagnitude(left))[0];
  } else {
    throw new MemorialGeometryError('Selecione um elemento do tipo polígono.');
  }

  if (!Array.isArray(ring)) {
    throw new MemorialGeometryError('O polígono não possui um anel exterior válido.');
  }

  const coordinates = ring
    .map((coordinate) => [Number(coordinate?.[0]), Number(coordinate?.[1])])
    .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));

  if (coordinates.length > 1 && sameCoordinate(coordinates[0], coordinates.at(-1))) {
    coordinates.pop();
  }

  const unique = coordinates.filter((coordinate, index) => (
    index === 0 || !sameCoordinate(coordinate, coordinates[index - 1])
  ));
  if (unique.length < 3) {
    throw new MemorialGeometryError('O polígono precisa ter ao menos três vértices.');
  }
  return unique;
}

export function utmZoneForLongitude(longitude) {
  return Math.min(60, Math.max(1, Math.floor((longitude + 180) / 6) + 1));
}

export function centralMeridianForZone(zone) {
  return zone * 6 - 183;
}

export function geographicToUtm(longitude, latitude, zone = utmZoneForLongitude(longitude)) {
  const semiMinor = WGS84_A * (1 - WGS84_F);
  const eccentricitySquared = (WGS84_A ** 2 - semiMinor ** 2) / WGS84_A ** 2;
  const secondEccentricitySquared = (WGS84_A ** 2 - semiMinor ** 2) / semiMinor ** 2;
  const latitudeRadians = latitude * Math.PI / 180;
  const longitudeRadians = longitude * Math.PI / 180;
  const centralMeridian = centralMeridianForZone(zone);
  const deltaLongitude = longitudeRadians - centralMeridian * Math.PI / 180;
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  const tangentSquared = Math.tan(latitudeRadians) ** 2;
  const c = secondEccentricitySquared * cosLatitude ** 2;
  const coefficient = cosLatitude * deltaLongitude;
  const primeVerticalRadius = WGS84_A / Math.sqrt(1 - eccentricitySquared * sinLatitude ** 2);
  const e4 = eccentricitySquared ** 2;
  const e6 = eccentricitySquared ** 3;
  const meridionalArc = WGS84_A * (
    (1 - eccentricitySquared / 4 - 3 * e4 / 64 - 5 * e6 / 256) * latitudeRadians
    - (3 * eccentricitySquared / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * latitudeRadians)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * latitudeRadians)
    - (35 * e6 / 3072) * Math.sin(6 * latitudeRadians)
  );
  const easting = UTM_SCALE * primeVerticalRadius * (
    coefficient
    + (1 - tangentSquared + c) * coefficient ** 3 / 6
    + (5 - 18 * tangentSquared + tangentSquared ** 2 + 72 * c - 58 * secondEccentricitySquared)
      * coefficient ** 5 / 120
  ) + UTM_FALSE_EASTING;
  const falseNorthing = latitude < 0 ? 10000000 : 0;
  const northing = UTM_SCALE * (
    meridionalArc + primeVerticalRadius * Math.tan(latitudeRadians) * (
      coefficient ** 2 / 2
      + (5 - tangentSquared + 9 * c + 4 * c ** 2) * coefficient ** 4 / 24
      + (61 - 58 * tangentSquared + tangentSquared ** 2 + 600 * c - 330 * secondEccentricitySquared)
        * coefficient ** 6 / 720
    )
  ) + falseNorthing;
  return { easting, northing, zone, hemisphere: latitude < 0 ? 'S' : 'N' };
}

export function meridianConvergence(longitude, latitude, zone) {
  const semiMinor = WGS84_A * (1 - WGS84_F);
  const secondEccentricitySquared = (WGS84_A ** 2 - semiMinor ** 2) / semiMinor ** 2;
  const latitudeRadians = latitude * Math.PI / 180;
  const deltaLongitude = (longitude - centralMeridianForZone(zone)) * Math.PI / 180;
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  const etaSquared = secondEccentricitySquared * cosLatitude ** 2;
  const convergence = deltaLongitude * sinLatitude
    + (deltaLongitude ** 3 / 3) * sinLatitude * cosLatitude ** 2 * (1 + 3 * etaSquared)
    + (deltaLongitude ** 5 / 15) * sinLatitude * cosLatitude ** 4
      * (2 - Math.tan(latitudeRadians) ** 2);
  return convergence * 180 / Math.PI;
}

export function normalizeAzimuth(value) {
  return ((value % 360) + 360) % 360;
}

export function formatDegreesMinutesSeconds(value) {
  const normalized = normalizeAzimuth(value);
  let degrees = Math.floor(normalized);
  const minutesFloat = (normalized - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = Math.round((minutesFloat - minutes) * 600) / 10;
  if (seconds >= 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    degrees = (degrees + 1) % 360;
  }
  return `${degrees}°${String(minutes).padStart(2, '0')}'${seconds.toFixed(1).padStart(4, '0')}"`;
}

function signedProjectedArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    sum += points[index].easting * points[next].northing;
    sum -= points[next].easting * points[index].northing;
  }
  return sum / 2;
}

function startAtNorthernmost(points) {
  let northernmostIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    const isFurtherNorth = points[index].northing > points[northernmostIndex].northing;
    const sameNorthing = Math.abs(points[index].northing - points[northernmostIndex].northing) < 1e-7;
    if (isFurtherNorth || (sameNorthing && points[index].easting < points[northernmostIndex].easting)) {
      northernmostIndex = index;
    }
  }
  return [...points.slice(northernmostIndex), ...points.slice(0, northernmostIndex)];
}

export function buildMemorial(element) {
  const coordinates = extractExteriorRing(element);
  const centroidLongitude = coordinates.reduce((sum, point) => sum + point[0], 0) / coordinates.length;
  const centroidLatitude = coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length;
  const zone = utmZoneForLongitude(centroidLongitude);
  const hemisphere = centroidLatitude < 0 ? 'S' : 'N';
  const convergence = meridianConvergence(centroidLongitude, centroidLatitude, zone);
  let projected = coordinates.map(([longitude, latitude]) => ({
    longitude,
    latitude,
    ...geographicToUtm(longitude, latitude, zone),
  }));
  if (signedProjectedArea(projected) > 0) projected = projected.reverse();
  projected = startAtNorthernmost(projected);

  let perimeter = 0;
  const rows = projected.map((point, index) => {
    const nextIndex = (index + 1) % projected.length;
    const next = projected[nextIndex];
    const deltaEasting = next.easting - point.easting;
    const deltaNorthing = next.northing - point.northing;
    const distance = Math.hypot(deltaEasting, deltaNorthing);
    const gridAzimuth = normalizeAzimuth(Math.atan2(deltaEasting, deltaNorthing) * 180 / Math.PI);
    const trueAzimuth = normalizeAzimuth(gridAzimuth + convergence);
    perimeter += distance;
    return {
      vertex: `Pt${index}`,
      easting: point.easting,
      northing: point.northing,
      side: `Pt${index}-Pt${nextIndex}`,
      gridAzimuth,
      trueAzimuth,
      distance,
    };
  });

  return {
    zone,
    hemisphere,
    zoneLabel: `${zone}${hemisphere}`,
    centralMeridian: centralMeridianForZone(zone),
    convergence,
    vertexCount: projected.length,
    perimeter,
    area: Math.abs(signedProjectedArea(projected)),
    rows,
  };
}
