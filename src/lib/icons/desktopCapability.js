/** @returns {boolean} */
export function canUseIconCanvasEditor(win = window) {
  return win.matchMedia('(pointer: fine)').matches && win.innerWidth >= 768;
}
