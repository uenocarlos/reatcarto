/** Closed polygon rings repeat the first vertex at the end. */
export function isClosedRing(ring) {
  if (!ring || ring.length < 2) return false;
  const last = ring.length - 1;
  return ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1];
}

/** Indexes of editable vertices (omits the closing duplicate on polygons). */
export function editableRingIndexes(ring) {
  if (!ring || ring.length === 0) return [];
  const last = ring.length - 1;
  if (last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]) {
    return Array.from({ length: last }, (_, i) => i);
  }
  return Array.from({ length: ring.length }, (_, i) => i);
}

/**
 * Midpoint ("disabled") handles between consecutive vertices.
 * `insertAt` is the index in the full ring where a new vertex is spliced when dragged.
 *
 * @param {number[][]} ringLngLat coordinates as [lng, lat]
 * @param {boolean} closed
 * @returns {{ key: string, insertAt: number, lat: number, lng: number }[]}
 */
export function midpointHandles(ringLngLat, closed) {
  if (!ringLngLat?.length) return [];
  const indexes = closed ? editableRingIndexes(ringLngLat) : ringLngLat.map((_, i) => i);
  if (indexes.length < 2) return [];

  const count = indexes.length;
  const segments = closed ? count : count - 1;
  const handles = [];

  for (let i = 0; i < segments; i += 1) {
    const aIdx = indexes[i];
    const bIdx = indexes[(i + 1) % count];
    const a = ringLngLat[aIdx];
    const b = ringLngLat[bIdx];
    if (!a || !b) continue;
    handles.push({
      key: `${aIdx}-${bIdx}`,
      insertAt: aIdx + 1,
      lat: (a[1] + b[1]) / 2,
      lng: (a[0] + b[0]) / 2,
    });
  }

  return handles;
}
