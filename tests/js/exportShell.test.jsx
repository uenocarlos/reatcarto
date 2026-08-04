import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportMapShell from '@/components/map/ExportMapShell';
import { DENSE_LEGEND_THRESHOLD } from '@/components/map/export/ExportControlsPanel';
import { PREVIEW_DEBOUNCE_MS } from '@/lib/export/constants';
import { INSTITUTIONAL_FOOTER_LINES, EXPORT_LOGO_PATH } from '@/lib/export/branding';
import {
  EditorExportHarness,
  makeGenerateDeps,
  makeSnapshot,
  sampleElement,
} from './helpers/exportHarness';

describe('ExportMapShell integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('IT-001: opens shell with preview root and actions', () => {
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({ elements: [] })}
      />,
    );

    expect(screen.getByTestId('export-map-shell')).toBeInTheDocument();
    expect(screen.getByTestId('export-composition-root')).toBeInTheDocument();
    expect(screen.getByTestId('export-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('export-download-button')).toBeInTheDocument();
  });

  it('IT-002: blank map name yields empty title input', () => {
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({ mapName: '' })}
      />,
    );

    expect(screen.getByTestId('export-title-input')).toHaveValue('');
  });

  it('IT-004: second export activation keeps single shell', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EditorExportHarness />);

    await user.click(screen.getByTestId('export-entry-button'));
    expect(screen.getAllByTestId('export-map-shell')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('export-entry-button'));
    expect(screen.getAllByTestId('export-map-shell')).toHaveLength(1);
  });

  it('IT-005: large element list scroll container present', () => {
    const elements = Array.from({ length: 500 }, (_, i) => sampleElement(`e${i}`, `El ${i}`));
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({ elements })}
      />,
    );

    const scroll = screen.getByTestId('export-layers-scroll');
    expect(scroll).toBeInTheDocument();
    expect(scroll.className).toMatch(/export-layers-scroll/);
  });

  it('IT-010: debounced preview reflects legend position and title', async () => {
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
      />,
    );

    fireEvent.change(screen.getByTestId('export-title-input'), { target: { value: 'Novo título' } });
    fireEvent.click(screen.getByLabelText('À direita'));

    await act(async () => {
      vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 50);
    });

    await waitFor(() => {
      expect(screen.getByTestId('export-composition-title')).toHaveTextContent('Novo título');
      const body = screen.getByTestId('export-composition-root').querySelector('.export-composition__body--legend-right');
      expect(body).toBeTruthy();
    });
  });

  it('IT-011: tile failure shows error and skips download', async () => {
    const generateDeps = makeGenerateDeps({
      waitForTiles: vi.fn().mockRejectedValue(Object.assign(new Error('tiles'), { code: 'tiles' })),
    });

    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-download-button'));

    await waitFor(() => {
      expect(screen.getByTestId('export-generation-error')).toBeInTheDocument();
    });
    expect(generateDeps.toPng).not.toHaveBeenCalled();
  });

  it('IT-012: dense legend and PDF show PNG preference hint', () => {
    const elements = Array.from({ length: DENSE_LEGEND_THRESHOLD }, (_, i) => sampleElement(`e${i}`, `L ${i}`));
    const { unmount } = render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({ elements })}
      />,
    );

    expect(screen.getByTestId('export-dense-legend-hint')).toBeInTheDocument();
    unmount();

    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({ elements: [sampleElement('e1')] })}
      />,
    );
    fireEvent.click(screen.getByLabelText('PDF'));
    expect(screen.getByTestId('export-dense-legend-hint')).toBeInTheDocument();
  });

  it('IT-013: institutional footer and logo remain with authorship', () => {
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
      />,
    );

    fireEvent.change(screen.getByTestId('export-authorship-input'), { target: { value: 'Autor X' } });

    act(() => {
      vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 50);
    });

    const footer = screen.getByTestId('export-institutional-footer');
    for (const line of INSTITUTIONAL_FOOTER_LINES) {
      expect(footer.textContent).toContain(line);
    }
    expect(screen.getByTestId('export-institutional-logo')).toHaveAttribute('src', EXPORT_LOGO_PATH);
  });

  it('IT-014: empty title blocks export', async () => {
    const generateDeps = makeGenerateDeps();
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({ mapName: '' })}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-download-button'));

    expect(screen.getByTestId('export-title-error')).toHaveTextContent(/título/i);
    expect(generateDeps.toPng).not.toHaveBeenCalled();
  });

  it('IT-015: sanitized filename on successful export', async () => {
    const generateDeps = makeGenerateDeps();
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({ mapName: 'Mapa "Norte"' })}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-download-button'));

    await waitFor(() => {
      expect(generateDeps.toPng).toHaveBeenCalled();
    });
    expect(generateDeps.downloadBlob).toHaveBeenCalled();
    const fileName = generateDeps.downloadBlob.mock.calls[0][1];
    expect(fileName).toMatch(/\.png$/);
    expect(fileName).not.toMatch(/[/\\]/);
  });

  it('IT-016: format switch retains paper orientation dpi', async () => {
    const generateDeps = makeGenerateDeps();
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByLabelText('A3'));
    fireEvent.click(screen.getByLabelText('Retrato'));
    fireEvent.change(screen.getByTestId('export-dpi-input'), { target: { value: '150' } });
    fireEvent.click(screen.getByLabelText('PDF'));

    fireEvent.click(screen.getByTestId('export-download-button'));

    await waitFor(() => {
      expect(generateDeps.toPng).toHaveBeenCalled();
    });
  });

  it('IT-017: memory error shows recovery message', async () => {
    const generateDeps = makeGenerateDeps({
      toPng: vi.fn().mockRejectedValue(Object.assign(new Error('Out of memory'), {})),
    });

    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-download-button'));

    await waitFor(() => {
      expect(screen.getByTestId('export-generation-error')).toHaveTextContent(/DPI/i);
    });
    expect(screen.getByTestId('export-download-button')).not.toBeDisabled();
  });

  it('IT-022: layer toggles and all-off still allows export', async () => {
    const generateDeps = makeGenerateDeps();
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({
          elements: [sampleElement('e1'), sampleElement('e2')],
          hiddenIds: new Set(['e2']),
        })}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-layer-e1'));
    fireEvent.click(screen.getByTestId('export-layer-e2'));

    fireEvent.click(screen.getByTestId('export-download-button'));

    await waitFor(() => {
      expect(generateDeps.toPng).toHaveBeenCalled();
    });
  });

  it('IT-023: cancel keeps editor basemap unchanged', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EditorExportHarness initialBasemap="osm" />);

    await user.click(screen.getByTestId('export-entry-button'));
    fireEvent.click(screen.getByLabelText('Satélite'));
    await user.click(screen.getByTestId('export-cancel-button'));

    expect(screen.getByTestId('editor-basemap')).toHaveTextContent('osm');
  });

  it('IT-024: showLabels true still exports successfully', async () => {
    const generateDeps = makeGenerateDeps();
    const elements = Array.from({ length: 20 }, (_, i) => sampleElement(`e${i}`, `P ${i}`));
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot({ elements })}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-show-labels'));
    fireEvent.click(screen.getByTestId('export-download-button'));

    await waitFor(() => {
      expect(generateDeps.toPng).toHaveBeenCalled();
    });
  });

  it('IT-025: legend reflects open snapshot after parent mutation', async () => {
    const elements = [sampleElement('e1', 'Original')];
    const snapshot = makeSnapshot({ elements });
    const { rerender } = render(
      <ExportMapShell open onOpenChange={() => {}} snapshot={snapshot} />,
    );

    elements[0] = { ...elements[0], name: 'Mutated' };
    rerender(<ExportMapShell open onOpenChange={() => {}} snapshot={snapshot} />);

    expect(screen.getByTestId('export-composition-root')).toBeInTheDocument();
    expect(screen.getByTestId('export-legend-item')).toHaveTextContent('Original');
  });

  it('IT-050: single-flight blocks duplicate generate', async () => {
    let resolveExport;
    const generateDeps = makeGenerateDeps({
      toPng: vi.fn(() => new Promise((resolve) => { resolveExport = resolve; })),
    });

    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-download-button'));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByTestId('export-download-button'));

    expect(generateDeps.toPng).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('export-progress')).toBeInTheDocument();

    await act(async () => {
      resolveExport('data:image/png;base64,AAAA');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(generateDeps.downloadBlob).toHaveBeenCalledTimes(1);
    });
  });

  it('IT-051: close aborts pending generate', async () => {
    let rejectExport;
    const generateDeps = makeGenerateDeps({
      toPng: vi.fn(() => new Promise((_, reject) => { rejectExport = reject; })),
    });
    const onOpenChange = vi.fn();

    render(
      <ExportMapShell
        open
        onOpenChange={onOpenChange}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-download-button'));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByTestId('export-cancel-button'));

    await act(async () => {
      rejectExport?.(Object.assign(new Error('aborted'), { code: 'aborted' }));
      await Promise.resolve();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('IT-052: retry after success allowed', async () => {
    const generateDeps = makeGenerateDeps();
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-download-button'));
    await waitFor(() => expect(generateDeps.toPng).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('export-download-button'));
    await waitFor(() => expect(generateDeps.toPng).toHaveBeenCalledTimes(2));
  });

  it('IT-060: mobile viewports reach all control groups', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    window.innerWidth = 390;
    window.innerHeight = 844;
    render(
      <ExportMapShell open onOpenChange={() => {}} snapshot={makeSnapshot()} />,
    );

    for (const id of [
      'export-control-group-textos',
      'export-control-group-formato',
      'export-control-group-papel',
      'export-control-group-legenda',
      'export-control-group-camadas',
      'export-control-group-localizacao',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }

    window.innerWidth = 844;
    window.innerHeight = 390;
    fireEvent(window, new Event('resize'));

    expect(screen.getByTestId('export-control-group-basemap')).toBeInTheDocument();

    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
  });

  it('IT-061: title input remains visible and focusable', () => {
    render(
      <ExportMapShell open onOpenChange={() => {}} snapshot={makeSnapshot()} />,
    );

    const input = screen.getByTestId('export-title-input');
    input.focus();
    expect(input).toHaveFocus();
    expect(input).not.toHaveAttribute('hidden');
    expect(getComputedStyle(input).display).not.toBe('none');
  });

  it('IT-070: cancel discards options; reopen resets defaults', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EditorExportHarness />);

    await user.click(screen.getByTestId('export-entry-button'));
    fireEvent.change(screen.getByTestId('export-dpi-input'), { target: { value: '120' } });
    fireEvent.click(screen.getByLabelText('À direita'));
    await user.click(screen.getByTestId('export-cancel-button'));

    await user.click(screen.getByTestId('export-entry-button'));
    expect(screen.getByTestId('export-dpi-input')).toHaveValue(300);
    expect(screen.getByLabelText('Dentro do mapa')).toBeChecked();
  });

  it('IT-071: remount clears singleton session state', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<EditorExportHarness />);

    await user.click(screen.getByTestId('export-entry-button'));
    fireEvent.change(screen.getByTestId('export-dpi-input'), { target: { value: '200' } });
    await user.click(screen.getByTestId('export-cancel-button'));
    unmount();

    render(<EditorExportHarness />);
    await user.click(screen.getByTestId('export-entry-button'));
    expect(screen.getByTestId('export-dpi-input')).toHaveValue(300);
  });

  it('IT-072: unmount aborts in-flight generate', async () => {
    let resolveExport;
    const generateDeps = makeGenerateDeps({
      toPng: vi.fn(() => new Promise((resolve) => { resolveExport = resolve; })),
    });
    const { unmount } = render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.click(screen.getByTestId('export-download-button'));
    await act(async () => {
      await Promise.resolve();
    });
    unmount();

    await act(async () => {
      resolveExport?.('data:image/png;base64,AAAA');
      await Promise.resolve();
    });

    expect(generateDeps.downloadBlob).not.toHaveBeenCalled();
  });

  it('IT-073: document hidden keeps in-memory session dpi', async () => {
    render(
      <ExportMapShell open onOpenChange={() => {}} snapshot={makeSnapshot()} />,
    );

    fireEvent.change(screen.getByTestId('export-dpi-input'), { target: { value: '180' } });

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    fireEvent(document, new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });

    expect(screen.getByTestId('export-dpi-input')).toHaveValue(180);
  });
});
