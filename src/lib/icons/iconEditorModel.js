import {
  P0_TOOLS,
  P1_TOOLS,
  P2_TOOLS,
  ERASER_TOOL,
  FILL_TOOL,
  HAND_TOOL,
  EDITOR_TOOLS,
  MIN_STROKE_WIDTH,
  MAX_STROKE_WIDTH,
  MIN_OBJECT_SIZE,
  MAX_HISTORY_SNAPSHOTS,
} from './constants';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** @returns {{ activeTool: string; strokeColor: string; strokeWidth: number; isDrawing: boolean }} */
export function createToolState(overrides = {}) {
  return {
    activeTool: 'pencil',
    strokeColor: '#000000',
    strokeWidth: 4,
    isDrawing: false,
    ...overrides,
  };
}

/** @param {string} tool */
export function isValidP0Tool(tool) {
  return P0_TOOLS.includes(tool);
}

/** @param {string} tool */
export function isValidEditorTool(tool) {
  return EDITOR_TOOLS.includes(tool) || tool === FILL_TOOL || tool === HAND_TOOL;
}

/** @param {ReturnType<typeof createToolState>} state @param {string} tool */
export function setActiveTool(state, tool) {
  if (!isValidEditorTool(tool)) return state;
  if (state.isDrawing) {
    return { ...state, activeTool: tool, isDrawing: false };
  }
  return { ...state, activeTool: tool };
}

/** @param {number} width @param {number} [min] @param {number} [max] */
export function clampStrokeWidth(width, min = MIN_STROKE_WIDTH, max = MAX_STROKE_WIDTH) {
  return Math.min(max, Math.max(min, Number(width) || min));
}

/** @param {ReturnType<typeof createToolState>} state @param {number} width */
export function setStrokeWidth(state, width) {
  return { ...state, strokeWidth: clampStrokeWidth(width) };
}

/** @param {ReturnType<typeof createToolState>} state @param {string} color */
export function setStrokeColor(state, color) {
  if (!HEX_COLOR.test(color)) return state;
  return { ...state, strokeColor: color };
}

/** @param {ReturnType<typeof createToolState>} state */
export function beginDrawing(state) {
  return { ...state, isDrawing: true };
}

/** @param {ReturnType<typeof createToolState>} state */
export function endDrawing(state) {
  return { ...state, isDrawing: false };
}

/** @param {string} tool */
export function isToolVisibleInP0(tool) {
  return !P1_TOOLS.includes(tool);
}

/** @param {string} tool */
export function isToolVisibleInEditor(tool) {
  return EDITOR_TOOLS.includes(tool);
}

/**
 * @typedef {{ id: string; left: number; top: number; width: number; height: number; scaleX?: number; scaleY?: number; angle?: number }} EditorObject
 * @typedef {{ objects: EditorObject[]; selectedIds: string[] }} ObjectStore
 */

/** @param {EditorObject[]} [objects] @returns {ObjectStore} */
export function createObjectStore(objects = []) {
  return { objects: [...objects], selectedIds: [] };
}

/** @param {ObjectStore} store @param {string} id */
export function selectObject(store, id) {
  if (!store.objects.some((obj) => obj.id === id)) return store;
  return { ...store, selectedIds: [id] };
}

/** @param {ObjectStore} store @param {string[]} ids */
export function selectMultiple(store, ids) {
  const validIds = ids.filter((id) => store.objects.some((obj) => obj.id === id));
  return { ...store, selectedIds: validIds };
}

/** @param {ObjectStore} store @param {string} id */
export function removeFromSelection(store, id) {
  return { ...store, selectedIds: store.selectedIds.filter((selectedId) => selectedId !== id) };
}

/** Empty marquee policy: clears the current selection. */
export function handleEmptyMarquee(store) {
  return { ...store, selectedIds: [] };
}

/**
 * @param {ObjectStore} store
 * @param {{ translateX?: number; translateY?: number; scaleX?: number; scaleY?: number; angle?: number }} transform
 */
export function applyGroupTransform(store, transform) {
  if (store.selectedIds.length === 0) return store;

  const selected = new Set(store.selectedIds);
  return {
    ...store,
    objects: store.objects.map((obj) => {
      if (!selected.has(obj.id)) return obj;
      return {
        ...obj,
        left: obj.left + (transform.translateX ?? 0),
        top: obj.top + (transform.translateY ?? 0),
        scaleX: transform.scaleX ?? obj.scaleX ?? 1,
        scaleY: transform.scaleY ?? obj.scaleY ?? 1,
        angle: transform.angle ?? obj.angle ?? 0,
      };
    }),
  };
}

/** @param {ObjectStore} store @param {typeof applyGroupTransform extends (s: ObjectStore, t: infer T) => unknown ? T : never} transform */
export function applyTransform(store, transform) {
  return applyGroupTransform(store, transform);
}

/** @param {number} width @param {number} height @param {number} [minSize] */
export function clampObjectSize(width, height, minSize = MIN_OBJECT_SIZE) {
  return {
    width: Math.max(minSize, width),
    height: Math.max(minSize, height),
  };
}

/** @param {ObjectStore} store @param {number} width @param {number} height */
export function resizeSelectedObject(store, width, height) {
  const selectedId = store.selectedIds[0];
  if (!selectedId) return store;

  const clamped = clampObjectSize(width, height);
  return {
    ...store,
    objects: store.objects.map((obj) => {
      if (obj.id !== selectedId) return obj;
      return { ...obj, width: clamped.width, height: clamped.height };
    }),
  };
}

/** @param {EditorObject} obj @param {number} x @param {number} y */
function pointInObject(obj, x, y) {
  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;
  const width = obj.width * scaleX;
  const height = obj.height * scaleY;
  return x >= obj.left && x <= obj.left + width && y >= obj.top && y <= obj.top + height;
}

/** @param {ObjectStore} store @param {number} x @param {number} y @returns {string | null} */
export function hitTestTopmost(store, x, y) {
  for (let index = store.objects.length - 1; index >= 0; index -= 1) {
    const obj = store.objects[index];
    if (pointInObject(obj, x, y)) {
      return obj.id;
    }
  }
  return null;
}

/** @param {ObjectStore} store */
export function deleteSelected(store) {
  if (store.selectedIds.length === 0) return store;
  const selected = new Set(store.selectedIds);
  return {
    objects: store.objects.filter((obj) => !selected.has(obj.id)),
    selectedIds: [],
  };
}

/** @param {ObjectStore} store @param {number} x @param {number} y */
export function eraseAtPoint(store, x, y) {
  const id = hitTestTopmost(store, x, y);
  if (!id) return store;
  return {
    objects: store.objects.filter((obj) => obj.id !== id),
    selectedIds: store.selectedIds.filter((selectedId) => selectedId !== id),
  };
}

/** @param {ObjectStore} store */
export function clearAllObjects(store) {
  return { objects: [], selectedIds: [] };
}

/** @param {number} width @param {number} height */
export function triangleArea(width, height) {
  return (Math.abs(width) * Math.abs(height)) / 2;
}

/** @param {number} width @param {number} height @param {number} [minSize] */
export function isDegenerateTriangle(width, height, minSize = MIN_OBJECT_SIZE) {
  return Math.abs(width) < minSize || Math.abs(height) < minSize;
}

/** @param {number} width @param {number} height @param {number} [minSize] */
export function clampTriangleSize(width, height, minSize = MIN_OBJECT_SIZE) {
  return clampObjectSize(width, height, minSize);
}

/**
 * @typedef {{ undoStack: string[]; redoStack: string[] }} HistoryState
 */

/** @returns {HistoryState} */
export function createHistoryState() {
  return { undoStack: [], redoStack: [] };
}

/**
 * @param {HistoryState} state
 * @param {string} snapshot
 * @param {{ selectionOnly?: boolean; maxSnapshots?: number }} [options]
 */
export function pushHistorySnapshot(state, snapshot, options = {}) {
  if (options.selectionOnly) return state;

  const maxSnapshots = options.maxSnapshots ?? MAX_HISTORY_SNAPSHOTS;
  const undoStack = [...state.undoStack, snapshot];
  if (undoStack.length > maxSnapshots) {
    undoStack.splice(0, undoStack.length - maxSnapshots);
  }

  return { undoStack, redoStack: [] };
}

/** @param {HistoryState} state @param {string} currentSnapshot */
export function undoHistory(state, currentSnapshot) {
  if (state.undoStack.length === 0) {
    return { state, snapshot: null };
  }

  const snapshot = state.undoStack[state.undoStack.length - 1];
  return {
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, currentSnapshot],
    },
    snapshot,
  };
}

/** @param {HistoryState} state @param {string} currentSnapshot */
export function redoHistory(state, currentSnapshot) {
  if (state.redoStack.length === 0) {
    return { state, snapshot: null };
  }

  const snapshot = state.redoStack[state.redoStack.length - 1];
  return {
    state: {
      undoStack: [...state.undoStack, currentSnapshot],
      redoStack: state.redoStack.slice(0, -1),
    },
    snapshot,
  };
}

/** @param {HistoryState} state */
export function canUndo(state) {
  return state.undoStack.length > 0;
}

/** @param {HistoryState} state */
export function canRedo(state) {
  return state.redoStack.length > 0;
}

export { ERASER_TOOL, P2_TOOLS };
