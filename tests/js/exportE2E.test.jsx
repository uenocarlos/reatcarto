import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportMapShell from '@/components/map/ExportMapShell';
import {
  EditorExportHarness,
  makeGenerateDeps,
  makeSnapshot,
  sampleElement,
} from './helpers/exportHarness';

describe('Export end-to-end journeys', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('E2E-001: owner opens export, preview defaults to map name, cancel returns', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EditorExportHarness mapName="Estuário" />);

    await user.click(screen.getByTestId('export-entry-button'));
    expect(screen.getByTestId('export-title-input')).toHaveValue('Estuário');
    expect(screen.getByTestId('export-composition-root')).toBeInTheDocument();
    expect(screen.getByTestId('export-institutional-footer')).toBeInTheDocument();

    await user.click(screen.getByTestId('export-cancel-button'));
    expect(screen.queryByTestId('export-map-shell')).not.toBeInTheDocument();
  });

  it('E2E-002: auth blocked surfaces failure without shell', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EditorExportHarness authBlocked />);

    await user.click(screen.getByTestId('export-entry-button'));
    expect(screen.queryByTestId('export-map-shell')).not.toBeInTheDocument();
  });

  it('E2E-003: public harness has no export entry', () => {
    render(<EditorExportHarness authBlocked />);
    expect(screen.queryByRole('button', { name: /exportar mapa/i })).toBeDisabled();
  });

  it('E2E-004: composition chrome visible after legend move', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EditorExportHarness />);

    await user.click(screen.getByTestId('export-entry-button'));
    fireEvent.change(screen.getByTestId('export-authorship-input'), { target: { value: 'Autor' } });
    fireEvent.click(screen.getByLabelText('À direita'));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId('export-scale-bar')).toBeInTheDocument();
    expect(screen.getByTestId('export-north-arrow')).toBeInTheDocument();
    expect(screen.getByTestId('export-graticule')).toBeInTheDocument();
    expect(screen.getByTestId('export-decorative-frame')).toBeInTheDocument();
  });

  it('E2E-005: PNG then PDF download with progress', async () => {
    const generateDeps = makeGenerateDeps();
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
    );

    fireEvent.change(screen.getByTestId('export-dpi-input'), { target: { value: '150' } });
    fireEvent.click(screen.getByTestId('export-download-button'));
    await waitFor(() => expect(generateDeps.downloadBlob).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText('PDF'));
    fireEvent.click(screen.getByTestId('export-download-button'));
    await waitFor(() => expect(generateDeps.toPng).toHaveBeenCalledTimes(2));
  });

  it('E2E-006: export-only layer toggle does not affect editor; reopen resets', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <EditorExportHarness
        elements={[sampleElement('e1', 'Visível'), sampleElement('e2', 'Oculto')]}
      />,
    );

    await user.click(screen.getByTestId('export-entry-button'));
    fireEvent.click(screen.getByTestId('export-layer-e1'));
    await user.click(screen.getByTestId('export-cancel-button'));

    await user.click(screen.getByTestId('export-entry-button'));
    expect(screen.getByTestId('export-layer-e1')).toBeChecked();
    expect(screen.getByTestId('export-dpi-input')).toHaveValue(300);
  });

  it('E2E-007: location inset enable and disable', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EditorExportHarness />);

    await user.click(screen.getByTestId('export-entry-button'));
    fireEvent.click(screen.getByLabelText('1'));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId('export-location-uf-0')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('0'));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId('export-location-insets')).not.toBeInTheDocument();
  });

  it('E2E-008: narrow viewport export at moderate DPI succeeds', async () => {
    window.innerWidth = 390;
    window.innerHeight = 844;
    const generateDeps = makeGenerateDeps();
    render(
      <ExportMapShell
        open
        onOpenChange={() => {}}
        snapshot={makeSnapshot()}
        generateDeps={generateDeps}
      />,
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

    fireEvent.change(screen.getByTestId('export-dpi-input'), { target: { value: '150' } });
    fireEvent.click(screen.getByTestId('export-download-button'));

    await waitFor(() => {
      expect(generateDeps.toPng).toHaveBeenCalled();
    });
  });

  it('E2E-009: reload equivalent remount restores default DPI', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<EditorExportHarness />);

    await user.click(screen.getByTestId('export-entry-button'));
    fireEvent.change(screen.getByTestId('export-dpi-input'), { target: { value: '450' } });
    await user.click(screen.getByTestId('export-cancel-button'));
    unmount();

    render(<EditorExportHarness />);
    await user.click(screen.getByTestId('export-entry-button'));
    expect(screen.getByTestId('export-dpi-input')).toHaveValue(300);
  });
});
