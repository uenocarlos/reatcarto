import { describe, expect, it, vi } from 'vitest';
import {
  editorMountKey,
  nextEditorMountToken,
  showIconEditorEntry,
} from '@/lib/icons/stylePanelEditorHelpers';

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

describe('stylePanelEditorHelpers', () => {
  it('UT-020: showIconEditorEntry true when desktop gate passes', () => {
    expect(showIconEditorEntry(mockWindow({ finePointer: true, width: 1024 }))).toBe(true);
  });

  it('UT-021: editor mount token increments on each remount cycle', () => {
    expect(nextEditorMountToken(0)).toBe(1);
    expect(nextEditorMountToken(1)).toBe(2);
    expect(editorMountKey(2)).toBe('icon-canvas-editor-2');
  });

  it('UT-022: showIconEditorEntry false when gate fails', () => {
    expect(showIconEditorEntry(mockWindow({ finePointer: false, width: 1200 }))).toBe(false);
    expect(showIconEditorEntry(mockWindow({ finePointer: true, width: 767 }))).toBe(false);
  });
});
