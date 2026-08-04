import React, { useCallback, useRef, useState } from 'react';
import { vi } from 'vitest';
import ExportMapShell from '@/components/map/ExportMapShell';
import ExportEntry from '@/components/map/ExportEntry';
import { createDefaultExportSession, createEditorExportSnapshot } from '@/lib/export';

export function sampleElement(id, name = 'Elemento', overrides = {}) {
  return {
    id,
    name,
    element_type: 'point',
    geojson: JSON.stringify({ type: 'Point', coordinates: [-51.2, -30.1] }),
    style: JSON.stringify({ icon_color: '#ff0000' }),
    ...overrides,
  };
}

export function makeSnapshot(overrides = {}) {
  return createEditorExportSnapshot({
    mapName: 'Mapa Teste',
    center: { lat: -30.1, lng: -51.2 },
    zoom: 10,
    hiddenIds: [],
    basemap: 'osm',
    elements: [sampleElement('e1', 'Ponto A')],
    ...overrides,
  });
}

export function makeGenerateDeps(overrides = {}) {
  return {
    toPng: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
    downloadBlob: vi.fn(),
    waitForTiles: vi.fn().mockResolvedValue(undefined),
    dataUrlToBlob: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
    jsPDF: class FakeJsPDF {
      constructor() {
        this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
      }
      addImage() {}
      save() {}
    },
    savePdf: vi.fn(),
    ...overrides,
  };
}

/**
 * Minimal editor host mirroring MapEditor export wiring for isolation tests.
 */
export function EditorExportHarness({
  initialBasemap = 'osm',
  elements = [sampleElement('e1')],
  mapName = 'Mapa Teste',
  authBlocked = false,
  generateDeps = null,
}) {
  const [basemap, setBasemap] = useState(initialBasemap);
  const [hiddenIds] = useState(() => new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSessionKey, setExportSessionKey] = useState(0);
  const [exportSnapshot, setExportSnapshot] = useState(null);
  const mapInstanceRef = useRef({
    getCenter: () => ({ lat: -30.1, lng: -51.2 }),
    getZoom: () => 10,
  });

  const buildSnapshot = useCallback(() => createEditorExportSnapshot({
    mapName,
    center: { lat: -30.1, lng: -51.2 },
    zoom: mapInstanceRef.current.getZoom(),
    hiddenIds,
    basemap,
    elements,
  }), [mapName, hiddenIds, basemap, elements]);

  const handleOpen = () => {
    if (exportOpen) return;
    if (authBlocked) return;
    setExportSnapshot(buildSnapshot());
    setExportSessionKey((k) => k + 1);
    setExportOpen(true);
  };

  return (
    <div>
      <span data-testid="editor-basemap">{basemap}</span>
      <ExportEntry onOpen={handleOpen} disabled={authBlocked} />
      {exportOpen && exportSnapshot ? (
        <ExportMapShell
          key={exportSessionKey}
          open={exportOpen}
          onOpenChange={(open) => {
            setExportOpen(open);
            if (!open) setExportSnapshot(null);
          }}
          snapshot={exportSnapshot}
          generateDeps={generateDeps}
        />
      ) : null}
      {authBlocked ? (
        <p data-testid="export-auth-blocked">Sessão expirada</p>
      ) : null}
    </div>
  );
}

export function openExportShell(screen, userEvent) {
  return userEvent.click(screen.getByTestId('export-entry-button'));
}

export { createDefaultExportSession, createEditorExportSnapshot };
