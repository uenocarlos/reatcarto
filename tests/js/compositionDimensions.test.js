import { describe, expect, it } from 'vitest';
import {
  EXPORT_COMPOSITION_LANDSCAPE_WIDTH,
  EXPORT_COMPOSITION_PORTRAIT_WIDTH,
  getFixedCompositionWidth,
  getFixedCompositionStyle,
} from '@/lib/export/compositionDimensions';

describe('compositionDimensions', () => {
  it('uses landscape width by default', () => {
    expect(getFixedCompositionWidth({ orientation: 'landscape' })).toBe(EXPORT_COMPOSITION_LANDSCAPE_WIDTH);
  });

  it('uses portrait width when requested', () => {
    expect(getFixedCompositionWidth({ orientation: 'portrait' })).toBe(EXPORT_COMPOSITION_PORTRAIT_WIDTH);
  });

  it('exposes CSS vars for fixed hosts', () => {
    expect(getFixedCompositionStyle({ orientation: 'landscape' })).toMatchObject({
      '--export-fixed-width': `${EXPORT_COMPOSITION_LANDSCAPE_WIDTH}px`,
    });
  });
});
