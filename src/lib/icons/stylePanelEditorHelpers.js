import { canUseIconCanvasEditor } from './desktopCapability';

/** @param {Window} [win] */
export function showIconEditorEntry(win = window) {
  return canUseIconCanvasEditor(win);
}

/** @param {number} token */
export function nextEditorMountToken(token) {
  return token + 1;
}

/** @param {number} token */
export function editorMountKey(token) {
  return `icon-canvas-editor-${token}`;
}
