import { describe, expect, it } from 'vitest';
import {
  editableRingIndexes,
  isClosedRing,
  midpointHandles,
  uniqueLatLngPoints,
  canFinishPolygonPoints,
} from '@/lib/editableGeometry';

describe('editableGeometry', () => {
  it('detects closed polygon rings', () => {
    expect(isClosedRing([[0, 0], [1, 0], [1, 1], [0, 0]])).toBe(true);
    expect(isClosedRing([[0, 0], [1, 0], [1, 1]])).toBe(false);
  });

  it('omits the closing duplicate from editable indexes', () => {
    expect(editableRingIndexes([[0, 0], [1, 0], [1, 1], [0, 0]])).toEqual([0, 1, 2]);
    expect(editableRingIndexes([[0, 0], [1, 0], [1, 1]])).toEqual([0, 1, 2]);
  });

  it('places line midpoints between consecutive vertices', () => {
    const line = [
      [0, 0],
      [2, 0],
      [2, 2],
    ];
    expect(midpointHandles(line, false)).toEqual([
      { key: '0-1', insertAt: 1, lat: 0, lng: 1 },
      { key: '1-2', insertAt: 2, lat: 1, lng: 2 },
    ]);
  });

  it('places polygon midpoints including the closing segment', () => {
    const ring = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 0],
    ];
    expect(midpointHandles(ring, true)).toEqual([
      { key: '0-1', insertAt: 1, lat: 0, lng: 2 },
      { key: '1-2', insertAt: 2, lat: 2, lng: 4 },
      { key: '2-0', insertAt: 3, lat: 2, lng: 2 },
    ]);
  });

  it('collapses freehand jitter when counting unique polygon points', () => {
    expect(uniqueLatLngPoints([[0, 0], [0, 0], [1, 0]])).toEqual([[0, 0], [1, 0]]);
    expect(uniqueLatLngPoints([
      [0, 0],
      [0.00000001, 0],
      [1, 0],
      [1, 1],
    ])).toEqual([[0, 0], [1, 0], [1, 1]]);
  });

  it('blocks finishing a polygon with fewer than 3 distinct points', () => {
    expect(canFinishPolygonPoints([])).toBe(false);
    expect(canFinishPolygonPoints([[0, 0]])).toBe(false);
    expect(canFinishPolygonPoints([[0, 0], [1, 0]])).toBe(false);
    expect(canFinishPolygonPoints([[0, 0], [0, 0], [0, 0]])).toBe(false);
    expect(canFinishPolygonPoints([[0, 0], [1, 0], [1, 1]])).toBe(true);
  });
});
