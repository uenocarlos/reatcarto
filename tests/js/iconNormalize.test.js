import { describe, expect, it } from 'vitest';
import {
  computeNormalizedDrawRect,
  findOpaqueBounds,
} from '@/lib/icons/iconNormalize';
import { ICON_CANVAS_SIZE, ICON_CONTENT_RATIO } from '@/lib/icons/constants';

function makeImageData(width, height, opaquePixels = []) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, alpha = 255] of opaquePixels) {
    const i = (y * width + x) * 4;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = alpha;
  }
  return { data, width, height };
}

describe('iconNormalize', () => {
  it('returns null bounds for fully transparent pixels', () => {
    expect(findOpaqueBounds(makeImageData(8, 8))).toBeNull();
    expect(
      findOpaqueBounds(makeImageData(4, 4, [[1, 1, 4]])),
    ).toBeNull();
  });

  it('finds opaque bounding box ignoring sub-threshold alpha', () => {
    const bounds = findOpaqueBounds(
      makeImageData(16, 16, [
        [2, 3],
        [5, 8],
        [4, 4, 2],
      ]),
    );

    expect(bounds).toEqual({
      minX: 2,
      minY: 3,
      maxX: 5,
      maxY: 8,
      width: 4,
      height: 6,
    });
  });

  it('fits small content into the standard optical frame', () => {
    const target = Math.round(ICON_CANVAS_SIZE * ICON_CONTENT_RATIO);
    const draw = computeNormalizedDrawRect({
      minX: 10,
      minY: 20,
      width: 20,
      height: 10,
    });

    expect(draw.sx).toBe(10);
    expect(draw.sy).toBe(20);
    expect(draw.sw).toBe(20);
    expect(draw.sh).toBe(10);
    expect(draw.dw).toBe(target);
    expect(draw.dh).toBe(Math.round(10 * (target / 20)));
    expect(Math.abs(draw.dx + draw.dw / 2 - ICON_CANVAS_SIZE / 2)).toBeLessThan(1);
    expect(Math.abs(draw.dy + draw.dh / 2 - ICON_CANVAS_SIZE / 2)).toBeLessThan(1);
  });

  it('keeps large square content inside the same optical size', () => {
    const target = Math.round(ICON_CANVAS_SIZE * ICON_CONTENT_RATIO);
    const draw = computeNormalizedDrawRect({
      minX: 0,
      minY: 0,
      width: 256,
      height: 256,
    });

    expect(draw.dw).toBe(target);
    expect(draw.dh).toBe(target);
    expect(draw.dx).toBe(Math.round((ICON_CANVAS_SIZE - target) / 2));
    expect(draw.dy).toBe(Math.round((ICON_CANVAS_SIZE - target) / 2));
  });
});
