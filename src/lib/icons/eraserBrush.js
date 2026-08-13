import { PencilBrush } from 'fabric';

/**
 * Free-drawing brush that erases pixels as the pointer moves (partial erase).
 */
export class EraserBrush extends PencilBrush {
  _setBrushStyles(ctx) {
    super._setBrushStyles(ctx);
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.globalCompositeOperation = 'destination-out';
  }

  /**
   * @param {import('fabric').TSimplePathData} pathData
   */
  createPath(pathData) {
    const path = super.createPath(pathData);
    path.set({
      stroke: 'rgba(0,0,0,1)',
      globalCompositeOperation: 'destination-out',
    });
    return path;
  }
}
