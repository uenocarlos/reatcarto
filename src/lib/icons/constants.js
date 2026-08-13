export const ICON_CANVAS_SIZE = 256;
/** CSS display size for the drawing surface. Export remains ICON_CANVAS_SIZE. */
export const ICON_EDITOR_DISPLAY_SIZE = 512;
/**
 * Fraction of the 256 artboard that drawn/uploaded content should fill.
 * ~12% inset matches built-in SVG optical weight (circle/square ≈ 75%).
 */
export const ICON_CONTENT_RATIO = 0.76;
export const ICON_ALPHA_THRESHOLD = 8;
export const MAX_ICON_BYTES = 200 * 1024;
export const MAX_ICON_NAME_LENGTH = 100;
export const ICON_NAME_FALLBACK = 'Ícone';

export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 20;
export const DEFAULT_STROKE_WIDTH = 4;
export const MIN_OBJECT_SIZE = 4;

export const P0_TOOLS = ['pencil', 'rect', 'circle', 'line'];
/** @deprecated P0 hide list — triangle ships in P2 (task_05) */
export const P1_TOOLS = ['triangle'];
export const P2_TOOLS = ['triangle'];
export const ERASER_TOOL = 'eraser';
export const FILL_TOOL = 'fill';
export const HAND_TOOL = 'hand';
export const EDITOR_TOOLS = [...P0_TOOLS, ...P2_TOOLS, ERASER_TOOL];
export const MAX_HISTORY_SNAPSHOTS = 50;

/** @type {readonly string[]} */
export const ICON_EDITOR_PALETTE = [
  '#000000',
  '#FFFFFF',
  '#F97316',
  '#EF4444',
  '#22C55E',
  '#3B82F6',
  '#A855F7',
];
