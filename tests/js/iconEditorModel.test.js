import { describe, expect, it } from 'vitest';
import {
  applyGroupTransform,
  applyTransform,
  beginDrawing,
  canRedo,
  canUndo,
  clampObjectSize,
  clampStrokeWidth,
  clampTriangleSize,
  clearAllObjects,
  createHistoryState,
  createObjectStore,
  createToolState,
  deleteSelected,
  eraseAtPoint,
  handleEmptyMarquee,
  hitTestTopmost,
  isDegenerateTriangle,
  isToolVisibleInEditor,
  isToolVisibleInP0,
  pushHistorySnapshot,
  redoHistory,
  removeFromSelection,
  resizeSelectedObject,
  selectMultiple,
  selectObject,
  setActiveTool,
  setStrokeColor,
  setStrokeWidth,
  undoHistory,
} from '@/lib/icons/iconEditorModel';
import { ERASER_TOOL, MIN_OBJECT_SIZE, MIN_STROKE_WIDTH, MAX_STROKE_WIDTH } from '@/lib/icons/constants';

describe('iconEditorModel tools', () => {
  it('UT-024: accepts P0 tools and stroke/color updates for new objects only', () => {
    let state = createToolState();
    expect(setActiveTool(state, 'rect').activeTool).toBe('rect');
    expect(setActiveTool(state, 'circle').activeTool).toBe('circle');
    expect(setActiveTool(state, 'line').activeTool).toBe('line');
    expect(setActiveTool(state, 'triangle').activeTool).toBe('triangle');
    expect(setActiveTool(state, ERASER_TOOL).activeTool).toBe(ERASER_TOOL);
    expect(setActiveTool(state, 'invalid').activeTool).toBe('pencil');

    state = setStrokeWidth(state, 8);
    expect(state.strokeWidth).toBe(8);

    state = setStrokeColor(state, '#F97316');
    expect(state.strokeColor).toBe('#F97316');
  });

  it('UT-025: stroke width clamps to min and max', () => {
    expect(clampStrokeWidth(0)).toBe(MIN_STROKE_WIDTH);
    expect(clampStrokeWidth(999)).toBe(MAX_STROKE_WIDTH);
    expect(setStrokeWidth(createToolState(), 0).strokeWidth).toBe(MIN_STROKE_WIDTH);
    expect(setStrokeWidth(createToolState(), 999).strokeWidth).toBe(MAX_STROKE_WIDTH);
  });

  it('UT-026: switching tool while drawing clears isDrawing', () => {
    const drawing = beginDrawing(createToolState());
    expect(drawing.isDrawing).toBe(true);

    const switched = setActiveTool(drawing, 'rect');
    expect(switched.isDrawing).toBe(false);
    expect(switched.activeTool).toBe('rect');
  });

  it('UT-027: color setter ignores non-hex input', () => {
    const state = createToolState({ strokeColor: '#000000' });
    expect(setStrokeColor(state, 'red').strokeColor).toBe('#000000');
    expect(setStrokeColor(state, '#ABC').strokeColor).toBe('#000000');
    expect(setStrokeColor(state, '#AABBCC').strokeColor).toBe('#AABBCC');
  });
});

describe('iconEditorModel selection', () => {
  const baseObjects = [
    { id: 'a', left: 0, top: 0, width: 20, height: 20 },
    { id: 'b', left: 10, top: 10, width: 20, height: 20 },
  ];

  it('UT-028: select object then apply translate/scale/rotate', () => {
    let store = createObjectStore(baseObjects);
    store = selectObject(store, 'a');
    store = applyTransform(store, {
      translateX: 5,
      translateY: 3,
      scaleX: 2,
      scaleY: 1.5,
      angle: 45,
    });

    const updated = store.objects.find((obj) => obj.id === 'a');
    expect(updated?.left).toBe(5);
    expect(updated?.top).toBe(3);
    expect(updated?.scaleX).toBe(2);
    expect(updated?.scaleY).toBe(1.5);
    expect(updated?.angle).toBe(45);
  });

  it('UT-029: resize toward zero clamps to minimum object size', () => {
    expect(clampObjectSize(0, 0).width).toBe(MIN_OBJECT_SIZE);
    expect(clampObjectSize(0, 0).height).toBe(MIN_OBJECT_SIZE);

    let store = selectObject(createObjectStore(baseObjects), 'a');
    store = resizeSelectedObject(store, 0, 0);
    const updated = store.objects.find((obj) => obj.id === 'a');
    expect(updated?.width).toBe(MIN_OBJECT_SIZE);
    expect(updated?.height).toBe(MIN_OBJECT_SIZE);
  });

  it('UT-030: hit-test overlapping stack returns topmost object id', () => {
    const store = createObjectStore(baseObjects);
    expect(hitTestTopmost(store, 15, 15)).toBe('b');
    expect(hitTestTopmost(store, 5, 5)).toBe('a');
  });

  it('UT-032: deleteSelected removes selected object; none selected is no-op', () => {
    let store = selectObject(createObjectStore(baseObjects), 'a');
    store = deleteSelected(store);
    expect(store.objects).toHaveLength(1);
    expect(store.selectedIds).toHaveLength(0);

    const unchanged = deleteSelected(createObjectStore(baseObjects));
    expect(unchanged.objects).toHaveLength(2);
  });
});

describe('iconEditorModel P0 scope', () => {
  it('UT-063: triangle tool hidden in P0', () => {
    expect(isToolVisibleInP0('triangle')).toBe(false);
    expect(isToolVisibleInP0('pencil')).toBe(true);
    expect(isToolVisibleInP0('rect')).toBe(true);
  });
});

describe('iconEditorModel multi-select', () => {
  const baseObjects = [
    { id: 'a', left: 0, top: 0, width: 20, height: 20 },
    { id: 'b', left: 30, top: 0, width: 20, height: 20 },
  ];

  it('UT-050: multi-select two ids then group translate moves both', () => {
    let store = selectMultiple(createObjectStore(baseObjects), ['a', 'b']);
    store = applyGroupTransform(store, { translateX: 10, translateY: 5 });

    expect(store.objects.find((obj) => obj.id === 'a')).toMatchObject({ left: 10, top: 5 });
    expect(store.objects.find((obj) => obj.id === 'b')).toMatchObject({ left: 40, top: 5 });
  });

  it('UT-051: multi-select of one id behaves as single selection', () => {
    const store = selectMultiple(createObjectStore(baseObjects), ['a']);
    expect(store.selectedIds).toEqual(['a']);

    const moved = applyGroupTransform(store, { translateX: 3, translateY: 2 });
    expect(moved.objects.find((obj) => obj.id === 'a')).toMatchObject({ left: 3, top: 2 });
    expect(moved.objects.find((obj) => obj.id === 'b')).toMatchObject({ left: 30, top: 0 });
  });

  it('UT-052: removing one id from selection leaves the other selected', () => {
    let store = selectMultiple(createObjectStore(baseObjects), ['a', 'b']);
    store = removeFromSelection(store, 'a');
    expect(store.selectedIds).toEqual(['b']);
  });

  it('UT-053: empty marquee clears selection', () => {
    let store = selectMultiple(createObjectStore(baseObjects), ['a', 'b']);
    store = handleEmptyMarquee(store);
    expect(store.selectedIds).toEqual([]);
    expect(store.objects).toHaveLength(2);
  });
});

describe('iconEditorModel history', () => {
  const emptySnapshot = '{"objects":[]}';
  const drawSnapshot = '{"objects":[{"id":"line-1"}]}';

  it('UT-054: draw → undo restores prior JSON snapshot; redo restores draw', () => {
    let history = createHistoryState();
    history = pushHistorySnapshot(history, emptySnapshot);
    const currentAfterDraw = drawSnapshot;

    const undoResult = undoHistory(history, currentAfterDraw);
    expect(undoResult.snapshot).toBe(emptySnapshot);
    expect(canUndo(undoResult.state)).toBe(false);
    expect(canRedo(undoResult.state)).toBe(true);

    const redoResult = redoHistory(undoResult.state, emptySnapshot);
    expect(redoResult.snapshot).toBe(drawSnapshot);
  });

  it('UT-055: undo with empty stack no-ops; undoDisabled true', () => {
    const history = createHistoryState();
    const result = undoHistory(history, emptySnapshot);
    expect(result.snapshot).toBeNull();
    expect(canUndo(history)).toBe(false);
  });

  it('UT-056: selection-only change does not push history', () => {
    let history = createHistoryState();
    const before = history.undoStack.length;
    history = pushHistorySnapshot(history, emptySnapshot, { selectionOnly: true });
    expect(history.undoStack).toHaveLength(before);
  });

  it('UT-057: clear canvas then undo restores objects', () => {
    let history = createHistoryState();
    history = pushHistorySnapshot(history, drawSnapshot);
    const clearedSnapshot = emptySnapshot;

    const undoResult = undoHistory(history, clearedSnapshot);
    expect(undoResult.snapshot).toBe(drawSnapshot);
  });
});

describe('iconEditorModel eraser and clear', () => {
  const baseObjects = [
    { id: 'a', left: 0, top: 0, width: 20, height: 20 },
    { id: 'b', left: 30, top: 0, width: 20, height: 20 },
  ];

  it('UT-058: eraser removes targeted object; clear removes all', () => {
    let store = eraseAtPoint(createObjectStore(baseObjects), 5, 5);
    expect(store.objects).toHaveLength(1);
    expect(store.objects[0].id).toBe('b');

    store = clearAllObjects(store);
    expect(store.objects).toHaveLength(0);
    expect(store.selectedIds).toHaveLength(0);
  });

  it('UT-059: eraser on empty canvas is no-op', () => {
    const store = eraseAtPoint(createObjectStore([]), 5, 5);
    expect(store.objects).toHaveLength(0);
  });
});

describe('iconEditorModel triangle', () => {
  it('UT-061: triangle tool is accepted in editor tool set', () => {
    expect(setActiveTool(createToolState(), 'triangle').activeTool).toBe('triangle');
    expect(isToolVisibleInEditor('triangle')).toBe(true);
  });

  it('UT-062: degenerate triangle is detected; clamp produces non-zero area', () => {
    expect(isDegenerateTriangle(0, 10)).toBe(true);
    expect(isDegenerateTriangle(10, 0)).toBe(true);
    expect(isDegenerateTriangle(2, 2)).toBe(true);

    const clamped = clampTriangleSize(0, 0);
    expect(clamped.width).toBeGreaterThanOrEqual(MIN_OBJECT_SIZE);
    expect(clamped.height).toBeGreaterThanOrEqual(MIN_OBJECT_SIZE);
    expect(isDegenerateTriangle(clamped.width, clamped.height)).toBe(false);
  });
});
