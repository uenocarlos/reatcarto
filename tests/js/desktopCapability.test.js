import { describe, expect, it, vi } from 'vitest';
import { canUseIconCanvasEditor } from '@/lib/icons/desktopCapability';

function mockWindow({ finePointer = true, width = 1024 } = {}) {
  return {
    innerWidth: width,
    matchMedia: vi.fn((query) => ({
      matches: query === '(pointer: fine)' ? finePointer : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  };
}

describe('canUseIconCanvasEditor', () => {
  it('UT-001: fine pointer and width 1024 returns true', () => {
    expect(canUseIconCanvasEditor(mockWindow({ finePointer: true, width: 1024 }))).toBe(true);
  });

  it('UT-002: width 767 returns false; coarse pointer and width 1200 returns false', () => {
    expect(canUseIconCanvasEditor(mockWindow({ finePointer: true, width: 767 }))).toBe(false);
    expect(canUseIconCanvasEditor(mockWindow({ finePointer: false, width: 1200 }))).toBe(false);
  });
});
