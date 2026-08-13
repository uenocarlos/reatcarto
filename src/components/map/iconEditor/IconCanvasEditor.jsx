import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, Circle, Line, PencilBrush, Rect, Triangle } from 'fabric';
import { EraserBrush } from '@/lib/icons/eraserBrush';
import ColorField from '@/components/map/ColorField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Circle as CircleIcon,
  Eraser,
  Hand,
  Minus,
  PaintBucket,
  Pencil,
  Redo2,
  Square,
  Triangle as TriangleIcon,
  Undo2,
} from 'lucide-react';
import {
  ICON_CANVAS_SIZE,
  ICON_EDITOR_DISPLAY_SIZE,
  ICON_NAME_FALLBACK,
  MAX_ICON_NAME_LENGTH,
  MIN_STROKE_WIDTH,
  MAX_STROKE_WIDTH,
  DEFAULT_STROKE_WIDTH,
  EDITOR_TOOLS,
  ERASER_TOOL,
  FILL_TOOL,
  HAND_TOOL,
} from '@/lib/icons/constants';
import {
  beginDrawing,
  canRedo,
  canUndo,
  clampTriangleSize,
  createHistoryState,
  createToolState,
  endDrawing,
  isDegenerateTriangle,
  isToolVisibleInEditor,
  pushHistorySnapshot,
  redoHistory,
  setActiveTool,
  setStrokeColor,
  setStrokeWidth,
  undoHistory,
} from '@/lib/icons/iconEditorModel';
import {
  canvasHasDrawableContent,
  isValidIconName,
  normalizeIconName,
  prepareNormalizedIconExport,
} from '@/lib/icons/iconExport';
import {
  duplicateWarningMessage,
  inspectIconDuplicates,
} from '@/lib/icons/iconDuplicateCheck';

const TOOL_LABELS = {
  pencil: 'Lápis',
  rect: 'Retângulo',
  circle: 'Círculo',
  line: 'Linha',
  triangle: 'Triângulo',
  [ERASER_TOOL]: 'Borracha',
};

const TOOL_ICONS = {
  pencil: Pencil,
  rect: Square,
  circle: CircleIcon,
  line: Minus,
  triangle: TriangleIcon,
  [ERASER_TOOL]: Eraser,
};

function isShapeTool(tool) {
  return tool === 'rect' || tool === 'circle' || tool === 'line' || tool === 'triangle';
}

function ToolButton({ active, label, title, onClick, disabled = false, children, className }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={className ?? 'h-8 w-8 p-0'}
    >
      {children}
    </Button>
  );
}

function ToolGroup({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

/**
 * @param {{
 *   open: boolean;
 *   onOpenChange: (open: boolean) => void;
 *   onConfirm: (payload: { blob: Blob; name: string; byteSize: number }) => Promise<void> | void;
 *   onCancel: () => void;
 *   confirmDisabled?: boolean;
 *   defaultName?: string;
 *   libraryIcons?: Array<{ id?: string; name?: string; url?: string }>;
 *   confirmDuplicate?: (message: string) => boolean;
 *   fetchIconBlob?: (url: string) => Promise<Blob | null>;
 * }} props
 */
export default function IconCanvasEditor({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  defaultName = '',
  libraryIcons = [],
  confirmDuplicate = (message) => window.confirm(message),
  fetchIconBlob,
}) {
  const canvasHostRef = useRef(null);
  const [canvasHostEl, setCanvasHostEl] = useState(null);
  const fabricRef = useRef(null);
  const shapeStartRef = useRef(null);
  const activeShapeRef = useRef(null);
  const historyRef = useRef(createHistoryState());
  const currentSnapshotRef = useRef('');
  const skipHistoryCommitRef = useRef(false);

  const [toolState, setToolState] = useState(() => createToolState());
  const [iconName, setIconName] = useState(
    () => normalizeIconName(defaultName) || ICON_NAME_FALLBACK,
  );
  const [hasContent, setHasContent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [historyUi, setHistoryUi] = useState({ undoDisabled: true, redoDisabled: true });

  const refreshContentFlag = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) {
      setHasContent(false);
      return;
    }
    setHasContent(canvasHasDrawableContent(canvas));
  }, []);

  const syncHistoryUi = useCallback((state) => {
    setHistoryUi({
      undoDisabled: !canUndo(state),
      redoDisabled: !canRedo(state),
    });
  }, []);

  const captureSnapshot = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return '';
    return JSON.stringify(canvas.toJSON());
  }, []);

  const commitHistory = useCallback((options = {}) => {
    if (skipHistoryCommitRef.current) return;

    const snapshot = captureSnapshot();
    if (snapshot === currentSnapshotRef.current) return;

    const next = pushHistorySnapshot(historyRef.current, currentSnapshotRef.current, options);
    historyRef.current = next;
    currentSnapshotRef.current = snapshot;
    syncHistoryUi(next);
    refreshContentFlag();
  }, [captureSnapshot, refreshContentFlag, syncHistoryUi]);

  const restoreSnapshot = useCallback(async (snapshot) => {
    const canvas = fabricRef.current;
    if (!canvas || snapshot == null) return;

    skipHistoryCommitRef.current = true;
    await canvas.loadFromJSON(JSON.parse(snapshot));
    canvas.requestRenderAll();
    currentSnapshotRef.current = snapshot;
    skipHistoryCommitRef.current = false;
    refreshContentFlag();
  }, [refreshContentFlag]);

  const applyBrushSettings = useCallback((canvas, state) => {
    if (!canvas) return;
    if (state.activeTool === ERASER_TOOL) {
      const brush = new EraserBrush(canvas);
      brush.width = state.strokeWidth;
      canvas.freeDrawingBrush = brush;
      return;
    }
    const brush = new PencilBrush(canvas);
    brush.color = state.strokeColor;
    brush.width = state.strokeWidth;
    canvas.freeDrawingBrush = brush;
  }, []);

  const syncDrawingMode = useCallback((canvas, tool) => {
    if (!canvas) return;
    const isBrushTool = tool === 'pencil' || tool === ERASER_TOOL;
    const isHandTool = tool === HAND_TOOL;
    canvas.isDrawingMode = isBrushTool;
    canvas.selection = isHandTool;
    canvas.defaultCursor = isHandTool
      ? 'default'
      : isBrushTool || tool === FILL_TOOL
        ? 'crosshair'
        : 'default';
    canvas.hoverCursor = isHandTool ? 'move' : null;
  }, []);

  const assignCanvasHostRef = useCallback((node) => {
    canvasHostRef.current = node;
    setCanvasHostEl(node);
  }, []);

  useLayoutEffect(() => {
    if (!open || !canvasHostEl) return undefined;

    const canvasEl = document.createElement('canvas');
    canvasHostEl.replaceChildren(canvasEl);

    const canvas = new Canvas(canvasEl, {
      width: ICON_CANVAS_SIZE,
      height: ICON_CANVAS_SIZE,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: false,
    });

    if (typeof canvas.setDimensions === 'function') {
      canvas.setDimensions(
        { width: ICON_EDITOR_DISPLAY_SIZE, height: ICON_EDITOR_DISPLAY_SIZE },
        { cssOnly: true },
      );
    }

    fabricRef.current = canvas;
    historyRef.current = createHistoryState();
    currentSnapshotRef.current = JSON.stringify(canvas.toJSON());
    syncHistoryUi(historyRef.current);
    applyBrushSettings(canvas, toolState);
    syncDrawingMode(canvas, toolState.activeTool);

    const handleContentChange = () => refreshContentFlag();
    canvas.on('object:added', handleContentChange);
    canvas.on('object:removed', handleContentChange);
    canvas.on('object:modified', handleContentChange);
    canvas.on('path:created', handleContentChange);

    const handleHistoryCommit = () => commitHistory();
    canvas.on('object:modified', handleHistoryCommit);
    canvas.on('path:created', handleHistoryCommit);

    const handleSelectionHistory = () => {
      commitHistory({ selectionOnly: true });
    };
    canvas.on('selection:created', handleSelectionHistory);
    canvas.on('selection:updated', handleSelectionHistory);
    canvas.on('selection:cleared', handleSelectionHistory);

    return () => {
      canvas.off('object:added', handleContentChange);
      canvas.off('object:removed', handleContentChange);
      canvas.off('object:modified', handleContentChange);
      canvas.off('path:created', handleContentChange);
      canvas.off('object:modified', handleHistoryCommit);
      canvas.off('path:created', handleHistoryCommit);
      canvas.off('selection:created', handleSelectionHistory);
      canvas.off('selection:updated', handleSelectionHistory);
      canvas.off('selection:cleared', handleSelectionHistory);
      canvas.dispose();
      fabricRef.current = null;
      shapeStartRef.current = null;
      activeShapeRef.current = null;
    };
  }, [open, canvasHostEl]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    applyBrushSettings(canvas, toolState);
    syncDrawingMode(canvas, toolState.activeTool);
  }, [toolState, applyBrushSettings, syncDrawingMode]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (toolState.activeTool !== HAND_TOOL) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }, [toolState.activeTool]);

  const handleUndo = useCallback(() => {
    const current = captureSnapshot();
    const { state, snapshot } = undoHistory(historyRef.current, current);
    historyRef.current = state;
    syncHistoryUi(state);
    void restoreSnapshot(snapshot);
  }, [captureSnapshot, restoreSnapshot, syncHistoryUi]);

  const handleRedo = useCallback(() => {
    const current = captureSnapshot();
    const { state, snapshot } = redoHistory(historyRef.current, current);
    historyRef.current = state;
    syncHistoryUi(state);
    void restoreSnapshot(snapshot);
  }, [captureSnapshot, restoreSnapshot, syncHistoryUi]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      const canvas = fabricRef.current;
      if (!canvas) return;

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const active = canvas.getActiveObject();
      if (!active) return;

      event.preventDefault();
      if (active.type === 'activeSelection') {
        active.getObjects().forEach((obj) => canvas.remove(obj));
      } else {
        canvas.remove(active);
      }
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      commitHistory();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, commitHistory, handleUndo, handleRedo]);

  const handleToolSelect = (tool) => {
    setToolState((prev) => setActiveTool(prev, tool));
  };

  const handleStrokeWidthChange = ([value]) => {
    setToolState((prev) => setStrokeWidth(prev, value));
  };

  const handleColorSelect = (color) => {
    setToolState((prev) => setStrokeColor(prev, color));
  };

  const handleFillPointerDown = (event) => {
    const canvas = fabricRef.current;
    if (!canvas || toolState.activeTool !== FILL_TOOL) return;

    const target = canvas.findTarget(event.e);
    if (!target || target === canvas.backgroundImage) return;

    target.set('fill', toolState.strokeColor);
    canvas.requestRenderAll();
    commitHistory();
  };

  const handleCanvasPointerDown = (event) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (toolState.activeTool === FILL_TOOL) {
      handleFillPointerDown(event);
      return;
    }

    if (toolState.activeTool === HAND_TOOL) return;

    if (toolState.activeTool === ERASER_TOOL) return;

    if (toolState.activeTool === 'pencil') return;

    const target = canvas.findTarget(event.e);
    if (target && target !== canvas.backgroundImage) return;

    const pointer = canvas.getScenePoint(event.e);
    shapeStartRef.current = pointer;
    setToolState((prev) => beginDrawing(prev));

    const common = {
      stroke: toolState.strokeColor,
      strokeWidth: toolState.strokeWidth,
      fill: 'transparent',
      selectable: true,
      evented: true,
    };

    if (toolState.activeTool === 'rect') {
      activeShapeRef.current = new Rect({
        ...common,
        left: pointer.x,
        top: pointer.y,
        width: 1,
        height: 1,
      });
      canvas.add(activeShapeRef.current);
    } else if (toolState.activeTool === 'circle') {
      activeShapeRef.current = new Circle({
        ...common,
        left: pointer.x,
        top: pointer.y,
        radius: 1,
      });
      canvas.add(activeShapeRef.current);
    } else if (toolState.activeTool === 'line') {
      activeShapeRef.current = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        ...common,
        selectable: true,
        evented: true,
      });
      canvas.add(activeShapeRef.current);
    } else if (toolState.activeTool === 'triangle') {
      activeShapeRef.current = new Triangle({
        ...common,
        left: pointer.x,
        top: pointer.y,
        width: 1,
        height: 1,
      });
      canvas.add(activeShapeRef.current);
    }
  };

  const handleClearCanvas = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().slice().forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    commitHistory();
  };

  const finishShapeGesture = () => {
    const canvas = fabricRef.current;
    const shape = activeShapeRef.current;

    if (shape && toolState.activeTool === 'triangle' && canvas) {
      const width = shape.width ?? 0;
      const height = shape.height ?? 0;
      if (isDegenerateTriangle(width, height)) {
        canvas.remove(shape);
      }
    }

    shapeStartRef.current = null;
    activeShapeRef.current = null;
    setToolState((prev) => endDrawing(prev));

    if (shape) {
      commitHistory();
    }
    refreshContentFlag();
  };

  const handleCanvasPointerMove = (event) => {
    const canvas = fabricRef.current;
    const start = shapeStartRef.current;
    const shape = activeShapeRef.current;
    if (!canvas || !start || !shape) return;

    const pointer = canvas.getScenePoint(event.e);

    if (toolState.activeTool === 'rect' && shape instanceof Rect) {
      const width = Math.abs(pointer.x - start.x);
      const height = Math.abs(pointer.y - start.y);
      shape.set({
        left: Math.min(start.x, pointer.x),
        top: Math.min(start.y, pointer.y),
        width: Math.max(1, width),
        height: Math.max(1, height),
      });
    } else if (toolState.activeTool === 'circle' && shape instanceof Circle) {
      const radius = Math.max(1, Math.hypot(pointer.x - start.x, pointer.y - start.y) / 2);
      shape.set({
        left: start.x - radius,
        top: start.y - radius,
        radius,
      });
    } else if (toolState.activeTool === 'line' && shape instanceof Line) {
      shape.set({ x2: pointer.x, y2: pointer.y });
    } else if (toolState.activeTool === 'triangle' && shape instanceof Triangle) {
      const width = Math.abs(pointer.x - start.x);
      const height = Math.abs(pointer.y - start.y);
      const clamped = clampTriangleSize(width, height);
      shape.set({
        left: Math.min(start.x, pointer.x),
        top: Math.min(start.y, pointer.y),
        width: clamped.width,
        height: clamped.height,
      });
    }

    shape.setCoords();
    canvas.requestRenderAll();
  };

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !open) return undefined;

    canvas.on('mouse:down', handleCanvasPointerDown);
    canvas.on('mouse:move', handleCanvasPointerMove);
    canvas.on('mouse:up', finishShapeGesture);

    return () => {
      canvas.off('mouse:down', handleCanvasPointerDown);
      canvas.off('mouse:move', handleCanvasPointerMove);
      canvas.off('mouse:up', finishShapeGesture);
    };
  }, [open, toolState.activeTool, toolState.strokeColor, toolState.strokeWidth]);

  const handleCancel = () => {
    setExportError(null);
    setIconName(normalizeIconName(defaultName) || ICON_NAME_FALLBACK);
    setToolState(createToolState());
    historyRef.current = createHistoryState();
    syncHistoryUi(historyRef.current);
    onCancel();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    const canvas = fabricRef.current;
    const name = normalizeIconName(iconName);
    if (!canvas || !hasContent || !name || confirming || confirmDisabled) {
      if (!name) setExportError('Dê um nome ao ícone.');
      return;
    }

    setExportError(null);
    setConfirming(true);
    try {
      const { blob, byteSize } = await prepareNormalizedIconExport(canvas);
      const conflict = await inspectIconDuplicates(libraryIcons, blob, name, { fetchIconBlob });
      if (conflict.kind !== 'none') {
        const proceed = confirmDuplicate(duplicateWarningMessage(conflict, name));
        if (!proceed) return;
      }
      await onConfirm({
        blob,
        byteSize,
        name,
      });
      setIconName(normalizeIconName(defaultName) || ICON_NAME_FALLBACK);
      setToolState(createToolState());
      historyRef.current = createHistoryState();
      syncHistoryUi(historyRef.current);
      onOpenChange(false);
    } catch (err) {
      setExportError(err?.message || 'Não foi possível exportar o ícone.');
    } finally {
      setConfirming(false);
    }
  };

  const visibleTools = EDITOR_TOOLS.filter((tool) => isToolVisibleInEditor(tool));
  const drawTools = visibleTools.filter((tool) => tool !== ERASER_TOOL);
  const colorLabel = toolState.activeTool === FILL_TOOL ? 'Cor do preenchimento' : 'Cor';
  const hasValidName = isValidIconName(iconName);
  const canConfirm = hasContent && hasValidName && !confirming && !confirmDisabled;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleCancel();
        }
      }}
    >
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto z-[1100]"
        overlayClassName="z-[1100]"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Desenhar ícone</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-full sm:w-56 shrink-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <ToolGroup label="Desenhar">
                  {drawTools.map((tool) => {
                    const Icon = TOOL_ICONS[tool] ?? Pencil;
                    return (
                      <ToolButton
                        key={tool}
                        active={toolState.activeTool === tool}
                        label={TOOL_LABELS[tool]}
                        onClick={() => handleToolSelect(tool)}
                      >
                        <Icon className="w-4 h-4" />
                      </ToolButton>
                    );
                  })}
                </ToolGroup>

                <ToolGroup label="Editar">
                  <ToolButton
                    active={toolState.activeTool === HAND_TOOL}
                    label="Mão"
                    title="Mão (mover e redimensionar)"
                    onClick={() => handleToolSelect(HAND_TOOL)}
                  >
                    <Hand className="w-4 h-4" />
                  </ToolButton>
                  <ToolButton
                    active={toolState.activeTool === FILL_TOOL}
                    label="Tinta"
                    title="Tinta (preenchimento)"
                    onClick={() => handleToolSelect(FILL_TOOL)}
                  >
                    <PaintBucket className="w-4 h-4" />
                  </ToolButton>
                  <ToolButton
                    active={toolState.activeTool === ERASER_TOOL}
                    label={TOOL_LABELS[ERASER_TOOL]}
                    onClick={() => handleToolSelect(ERASER_TOOL)}
                  >
                    <Eraser className="w-4 h-4" />
                  </ToolButton>
                </ToolGroup>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Espessura: {toolState.strokeWidth}px
                  </Label>
                  <Slider
                    value={[toolState.strokeWidth]}
                    min={MIN_STROKE_WIDTH}
                    max={MAX_STROKE_WIDTH}
                    step={1}
                    onValueChange={handleStrokeWidthChange}
                  />
                </div>

                <ColorField
                  label={colorLabel}
                  value={toolState.strokeColor}
                  onChange={handleColorSelect}
                />
              </div>

              <div className="flex items-center justify-center gap-1.5">
                <ToolButton
                  active={false}
                  label="Desfazer"
                  disabled={historyUi.undoDisabled}
                  onClick={handleUndo}
                >
                  <Undo2 className="w-4 h-4" />
                </ToolButton>
                <ToolButton
                  active={false}
                  label="Refazer"
                  disabled={historyUi.redoDisabled}
                  onClick={handleRedo}
                >
                  <Redo2 className="w-4 h-4" />
                </ToolButton>
                <Separator orientation="vertical" className="h-6 mx-0.5" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Limpar canvas"
                  title="Limpar canvas"
                  onClick={handleClearCanvas}
                  className="h-8 px-2.5 text-xs"
                >
                  Limpar
                </Button>
              </div>
            </div>

            <div
              className="mx-auto sm:mx-0 border rounded-md overflow-hidden bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] shrink-0"
              style={{ width: ICON_EDITOR_DISPLAY_SIZE, height: ICON_EDITOR_DISPLAY_SIZE }}
            >
              <div ref={assignCanvasHostRef} />
            </div>
          </div>

          <div>
            <Label htmlFor="icon-name" className="text-xs mb-1 block">
              Nome
            </Label>
            <Input
              id="icon-name"
              value={iconName}
              onChange={(event) => {
                setIconName(event.target.value);
                if (exportError) setExportError(null);
              }}
              placeholder="Ex.: Farol"
              maxLength={MAX_ICON_NAME_LENGTH}
              required
              aria-required="true"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
              Nome sugerido a partir do ícone atual. Você pode alterar antes de salvar.
            </p>
          </div>

          {exportError ? (
            <p className="text-xs text-destructive leading-snug">{exportError}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={confirming}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => { void handleConfirm(); }}
            disabled={!canConfirm}
          >
            {confirming ? 'Salvando…' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_STROKE_WIDTH };
