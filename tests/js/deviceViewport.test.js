import { describe, expect, it } from 'vitest';
import {
  getViewportMinDimension,
  isMobileViewport,
  isPortraitViewport,
} from '@/lib/deviceViewport';

describe('deviceViewport', () => {
  it('uses the smaller viewport dimension for mobile detection', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    window.innerWidth = 844;
    window.innerHeight = 390;
    expect(getViewportMinDimension()).toBe(390);
    expect(isMobileViewport()).toBe(true);

    window.innerWidth = 390;
    window.innerHeight = 844;
    expect(getViewportMinDimension()).toBe(390);
    expect(isMobileViewport()).toBe(true);

    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
  });

  it('detects portrait orientation', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    window.innerWidth = 390;
    window.innerHeight = 844;
    expect(isPortraitViewport()).toBe(true);

    window.innerWidth = 844;
    window.innerHeight = 390;
    expect(isPortraitViewport()).toBe(false);

    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
  });
});
