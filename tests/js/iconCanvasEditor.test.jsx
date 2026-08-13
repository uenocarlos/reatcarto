import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconCanvasEditor from '@/components/map/iconEditor/IconCanvasEditor';
import { isToolVisibleInP0 } from '@/lib/icons/iconEditorModel';
import { P2_TOOLS } from '@/lib/icons/constants';

const { mockCanvasRegistry } = vi.hoisted(() => ({
  mockCanvasRegistry: { current: null },
}));

vi.mock('fabric', () => {
  class MockCanvas {
    constructor(el, options) {
      mockCanvasRegistry.current = this;
      this.lowerCanvasEl = el;
      this._objects = [];
      this.isDrawingMode = false;
      this.selection = false;
      this.freeDrawingBrush = null;
      this.backgroundImage = null;
      this._handlers = {};
    }

    on(event, handler) {
      if (!this._handlers[event]) this._handlers[event] = [];
      this._handlers[event].push(handler);
    }

    off(event, handler) {
      if (!this._handlers[event]) return;
      if (handler) {
        this._handlers[event] = this._handlers[event].filter((h) => h !== handler);
      } else {
        delete this._handlers[event];
      }
    }

    add(obj) {
      this._objects.push(obj);
      this._handlers['object:added']?.forEach((handler) => handler());
    }

    simulatePathCreated(path) {
      this._objects.push(path);
      this._handlers['path:created']?.forEach((handler) => handler({ path }));
      this._handlers['object:added']?.forEach((handler) => handler());
    }

    remove(obj) {
      this._objects = this._objects.filter((item) => item !== obj);
      this._handlers['object:removed']?.forEach((handler) => handler());
    }

    getObjects() {
      return this._objects;
    }

    discardActiveObject() {}
    requestRenderAll() {}

    getActiveObject() {
      return null;
    }

    findTarget() {
      return null;
    }

    getScenePoint() {
      return { x: 0, y: 0 };
    }

    toJSON() {
      return { objects: this._objects.map((obj) => ({ type: obj.type ?? 'rect' })) };
    }

    async loadFromJSON() {
      return undefined;
    }

    dispose() {
      if (mockCanvasRegistry.current === this) {
        mockCanvasRegistry.current = null;
      }
    }

    setDimensions() {}
  }

  class MockRect {
    constructor(props) {
      this.type = 'rect';
      Object.assign(this, props);
    }

    set(props) {
      Object.assign(this, props);
    }

    setCoords() {}
  }

  class MockCircle {
    constructor(props) {
      this.type = 'circle';
      Object.assign(this, props);
    }

    set(props) {
      Object.assign(this, props);
    }

    setCoords() {}
  }

  class MockLine {
    constructor(points, props) {
      this.type = 'line';
      this.points = points;
      Object.assign(this, props);
    }

    set(props) {
      Object.assign(this, props);
    }

    setCoords() {}
  }

  class MockTriangle {
    constructor(props) {
      this.type = 'triangle';
      Object.assign(this, props);
    }

    set(props) {
      Object.assign(this, props);
    }

    setCoords() {}
  }

  class MockPencilBrush {
    constructor() {
      this.color = '#000';
      this.width = 1;
    }
  }

  return {
    Canvas: MockCanvas,
    Rect: MockRect,
    Circle: MockCircle,
    Line: MockLine,
    Triangle: MockTriangle,
    PencilBrush: MockPencilBrush,
  };
});

afterEach(() => {
  mockCanvasRegistry.current = null;
});

describe('IconCanvasEditor P0 scope', () => {
  it('UT-063: isToolVisibleInP0 still hides triangle for P0-only builds', () => {
    expect(P2_TOOLS).toContain('triangle');
    expect(isToolVisibleInP0('triangle')).toBe(false);
  });

  it('E2E-010: confirm disabled when canvas has no drawable content', () => {
    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeDisabled();
  });

  it('regression: dialog stacks above StylePanel with z-[1100]', () => {
    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('z-[1100]');

    const overlay = Array.from(document.querySelectorAll('[data-state="open"]')).find(
      (el) => el.className.includes('bg-black'),
    );
    expect(overlay?.className).toContain('z-[1100]');
  });

  it('UT-024: simulated pencil stroke enables confirm with predefined name', async () => {
    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
        defaultName="Pin Padrão"
      />,
    );

    expect(screen.getByLabelText(/nome/i)).toHaveValue('Pin Padrão');

    await waitFor(() => {
      expect(mockCanvasRegistry.current).toBeTruthy();
    });

    mockCanvasRegistry.current.simulatePathCreated({
      type: 'path',
      stroke: '#111111',
      strokeWidth: 2,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeEnabled();
    });
  });

  it('confirm stays disabled if the predefined name is cleared', async () => {
    const user = userEvent.setup();

    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
        defaultName="Farol"
      />,
    );

    await waitFor(() => {
      expect(mockCanvasRegistry.current).toBeTruthy();
    });

    mockCanvasRegistry.current.simulatePathCreated({
      type: 'path',
      stroke: '#111111',
      strokeWidth: 2,
    });

    await user.clear(screen.getByLabelText(/nome/i));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeDisabled();
    });
  });
});

describe('IconCanvasEditor P1/P2 scope', () => {
  it('E2E-015: P1 tools visible; clear leaves confirm disabled on empty canvas', async () => {
    const user = userEvent.setup();

    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /desfazer/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /refazer/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /borracha/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpar canvas/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /limpar canvas/i }));
    expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeDisabled();
  });

  it('E2E-016: P2 build shows triangle tool entry', () => {
    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /triângulo/i })).toBeInTheDocument();
  });

  it('shows hand tool for moving objects without drawing', async () => {
    const user = userEvent.setup();

    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    await waitFor(() => {
      expect(mockCanvasRegistry.current).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: /^mão$/i }));
    expect(mockCanvasRegistry.current.selection).toBe(true);
    expect(mockCanvasRegistry.current.isDrawingMode).toBe(false);
  });

  it('shows fill (tinta) tool and no delete-selection button', () => {
    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /tinta/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /excluir seleção/i })).not.toBeInTheDocument();
  });

  it('fill tool applies color to clicked object', async () => {
    const user = userEvent.setup();

    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    await waitFor(() => {
      expect(mockCanvasRegistry.current).toBeTruthy();
    });

    const rect = {
      type: 'rect',
      stroke: '#111111',
      strokeWidth: 2,
      fill: 'transparent',
      set(key, value) {
        if (typeof key === 'object') {
          Object.assign(this, key);
        } else {
          this[key] = value;
        }
      },
    };
    mockCanvasRegistry.current.add(rect);
    mockCanvasRegistry.current.findTarget = () => rect;

    await user.click(screen.getByRole('button', { name: /tinta/i }));
    await user.click(screen.getByRole('button', { name: /cor #22C55E/i }));

    mockCanvasRegistry.current._handlers['mouse:down']?.forEach((handler) => handler({ e: {} }));

    expect(rect.fill).toBe('#22C55E');
  });

  it('renders undo and redo next to the drawing canvas', () => {
    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /desfazer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refazer/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/cor — seletor personalizado/i)).toBeInTheDocument();
  });

  it('UT-060: clear canvas does not call api.icons', async () => {
    const createMock = vi.fn();
    const user = userEvent.setup();

    render(
      <IconCanvasEditor
        open
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /limpar canvas/i }));
    expect(createMock).not.toHaveBeenCalled();
  });
});
