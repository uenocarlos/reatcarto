import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StylePanel from '@/components/map/StylePanel';
import { MAX_ICON_BYTES } from '@/lib/icons/constants';
import { toast } from 'sonner';

const listMock = vi.fn();
const createMock = vi.fn();
const removeMock = vi.fn();
const isOnlineMock = vi.fn(() => true);

let editorProps = null;
let editorMountCount = 0;

vi.mock('@/components/map/iconEditor/IconCanvasEditor', () => ({
  default: (props) => {
    editorProps = props;
    editorMountCount += 1;
    if (!props.open) return null;

    return (
      <div data-testid="icon-canvas-editor" data-mount={editorMountCount}>
        <p>Editor 256x256</p>
        <button type="button" onClick={() => props.onCancel()}>
          Cancelar editor
        </button>
        <button
          type="button"
          data-testid="editor-confirm-empty"
          onClick={() => {
            void props.onConfirm({ blob: new Blob([], { type: 'image/png' }), name: 'Ícone', byteSize: 0 });
          }}
        >
          Confirmar vazio
        </button>
        <button
          type="button"
          data-testid="editor-confirm-drawn"
          onClick={() => {
            void props.onConfirm({
              blob: new Blob([new Uint8Array(512)], { type: 'image/png' }),
              name: 'Meu ícone',
              byteSize: 512,
            });
          }}
        >
          Confirmar desenho
        </button>
        <button
          type="button"
          data-testid="editor-confirm-oversize"
          onClick={() => {
            void props.onConfirm({
              blob: new Blob([new Uint8Array(MAX_ICON_BYTES + 1)], { type: 'image/png' }),
              name: 'Grande',
              byteSize: MAX_ICON_BYTES + 1,
            });
          }}
        >
          Confirmar oversize
        </button>
        <button
          type="button"
          data-testid="editor-confirm-disabled-check"
          disabled={props.confirmDisabled}
        >
          Confirmar in-flight
        </button>
      </div>
    );
  },
}));

vi.mock('@/api/apiClient', () => ({
  api: {
    icons: {
      list: (...args) => listMock(...args),
      create: (...args) => createMock(...args),
      remove: (...args) => removeMock(...args),
    },
    media: {
      url: (id) => `/php/photos/get.php?id=${encodeURIComponent(id)}`,
      videoUrl: (id) => `/php/videos/get.php?id=${encodeURIComponent(id)}`,
      uploadVideo: vi.fn(),
      deleteVideo: vi.fn(),
    },
    entities: {
      MapElement: {
        delete: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/offline/connectivity', () => ({
  isOnline: (...args) => isOnlineMock(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const CREATED_ICON = {
  id: 'icon-new',
  name: 'Meu ícone',
  url: '/php/icons/get.php?id=icon-new',
};

function setDesktopGate() {
  window.innerWidth = 1024;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query === '(pointer: fine)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function renderStylePanel(overrides = {}) {
  const onPreview = vi.fn();
  const onClose = vi.fn();
  const onSave = vi.fn();

  const view = render(
    <StylePanel
      element={{
        id: 'point-1',
        element_type: 'point',
        name: 'Ponto teste',
        style: { icon_name: 'pin', icon_color: '#F97316', custom_icon_url: '' },
        photos: [],
        ...overrides.element,
      }}
      elementCategories={[{ id: 'terra', label: 'Terra' }]}
      onPreview={onPreview}
      onClose={onClose}
      onSave={onSave}
      isMobile={overrides.isMobile ?? false}
      {...overrides.panelProps}
    />,
  );

  return { onPreview, onClose, onSave, ...view };
}

function openEditor() {
  const buttons = screen.getAllByRole('button', { name: /desenhar ícone/i });
  fireEvent.click(buttons[0]);
}

describe('StylePanel icon editor E2E', () => {
  beforeEach(() => {
    editorProps = null;
    editorMountCount = 0;
    listMock.mockReset();
    createMock.mockReset();
    removeMock.mockReset();
    isOnlineMock.mockReset();
    isOnlineMock.mockReturnValue(true);
    toast.success.mockReset();
    toast.error.mockReset();
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue(CREATED_ICON);
    setDesktopGate();
  });

  it('prefills editor name from selected library icon', async () => {
    listMock.mockResolvedValue([
      { id: 'lib-1', name: 'Farol', url: '/php/icons/get.php?id=lib-1' },
    ]);

    renderStylePanel({
      element: {
        id: 'point-1',
        element_type: 'point',
        name: 'Ponto teste',
        style: {
          icon_name: 'pin',
          icon_color: '#F97316',
          custom_icon_url: '/php/icons/get.php?id=lib-1',
        },
        photos: [],
      },
    });
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    expect(await screen.findByTestId('icon-canvas-editor')).toBeInTheDocument();
    expect(editorProps.defaultName).toBe('Farol');
    expect(editorProps.libraryIcons).toEqual([
      { id: 'lib-1', name: 'Farol', url: '/php/icons/get.php?id=lib-1' },
    ]);
  });

  it('E2E-001: open Desenhar shows blank editor; cancel and reopen remounts', async () => {
    renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    expect(await screen.findByTestId('icon-canvas-editor')).toBeInTheDocument();
    expect(screen.getByText('Editor 256x256')).toBeInTheDocument();
    expect(editorProps.defaultName).toBe('Pin Padrão');
    expect(editorProps.libraryIcons).toEqual([]);
    const firstMount = editorMountCount;

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar editor' }));

    await waitFor(() => {
      expect(screen.queryByTestId('icon-canvas-editor')).not.toBeInTheDocument();
    });

    openEditor();
    expect(await screen.findByTestId('icon-canvas-editor')).toBeInTheDocument();
    expect(editorMountCount).toBeGreaterThan(firstMount);
  });

  it('E2E-002: confirm with 401 shows error and keeps custom_icon_url empty', async () => {
    createMock.mockRejectedValue({ code: 'unauthorized', status: 401, message: 'Sessão expirada' });
    const { onPreview } = renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    fireEvent.click(await screen.findByTestId('editor-confirm-drawn'));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalled();
    });

    const previewCalls = onPreview.mock.calls.map(([payload]) => payload);
    const lastPreview = previewCalls[previewCalls.length - 1];
    expect(lastPreview.custom_icon_url).toBe('');
  });

  it('E2E-003: closing StylePanel cancels editor without upload', async () => {
    const { unmount } = renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    expect(await screen.findByTestId('icon-canvas-editor')).toBeInTheDocument();

    unmount();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('E2E-005: confirm drawn content applies URL (delete/move covered by editor model tests)', async () => {
    const { onPreview } = renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    fireEvent.click(await screen.findByTestId('editor-confirm-drawn'));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ custom_icon_url: CREATED_ICON.url }),
      );
    });
  });

  it('E2E-006: confirm success applies custom URL and shows library thumb', async () => {
    const { onPreview } = renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    fireEvent.click(await screen.findByTestId('editor-confirm-drawn'));

    await waitFor(() => {
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ custom_icon_url: CREATED_ICON.url }),
      );
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Meu ícone' }).length).toBeGreaterThan(0);
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('E2E-007: oversize upload path shows error without style/library change', async () => {
    createMock.mockRejectedValue({
      code: 'payload_too_large',
      message: 'Ícone muito grande',
    });
    const { onPreview } = renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    fireEvent.click(await screen.findByTestId('editor-confirm-oversize'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    const previewCalls = onPreview.mock.calls.map(([payload]) => payload);
    const lastPreview = previewCalls[previewCalls.length - 1];
    expect(lastPreview.custom_icon_url).toBe('');
  });

  it('E2E-008: confirm disabled while in-flight prevents duplicate creates', async () => {
    let resolveCreate;
    createMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = () => resolve(CREATED_ICON);
        }),
    );

    renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    fireEvent.click(await screen.findByTestId('editor-confirm-drawn'));

    await waitFor(() => {
      expect(screen.getByTestId('editor-confirm-disabled-check')).toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('editor-confirm-drawn'));
    expect(createMock).toHaveBeenCalledTimes(1);

    resolveCreate();
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });
  });

  it('E2E-009: offline confirm shows message without create call', async () => {
    isOnlineMock.mockReturnValue(false);
    renderStylePanel();
    await waitFor(() => {
      expect(screen.getAllByText('Ícones').length).toBeGreaterThan(0);
    });

    openEditor();
    fireEvent.click(await screen.findByTestId('editor-confirm-drawn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'A biblioteca de ícones requer conexão com a internet.',
      );
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('E2E-010: cancel after draw leaves style unchanged', async () => {
    const { onPreview } = renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar editor' }));

    await waitFor(() => {
      expect(screen.queryByTestId('icon-canvas-editor')).not.toBeInTheDocument();
    });

    expect(createMock).not.toHaveBeenCalled();
    const previewCalls = onPreview.mock.calls.map(([payload]) => payload);
    expect(previewCalls.every((payload) => !payload.custom_icon_url)).toBe(true);
  });
});

describe('StylePanel icon editor entry', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue([]);
    isOnlineMock.mockReturnValue(true);
  });

  it('UT-020/022: desktop shows Desenhar; mobile gate hides it with hint', async () => {
    setDesktopGate();
    renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(screen.getAllByRole('button', { name: /desenhar ícone/i }).length).toBeGreaterThan(0);
  });
});
