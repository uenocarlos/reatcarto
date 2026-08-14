import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GisExportDialog from '@/components/map/gis/GisExportDialog';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/offline/connectivity', () => ({
  isOnline: vi.fn(() => true),
}));

import { isOnline } from '@/lib/offline/connectivity';
import { toast } from 'sonner';

const elements = [
  {
    id: 'p1',
    name: 'Marco',
    element_type: 'point',
    element_category: 'terra',
    geojson: { type: 'Point', coordinates: [-52.1, -32] },
    style: { icon_name: 'pin' },
  },
  {
    id: 'l1',
    name: 'Trilha',
    element_type: 'line',
    element_category: 'agua',
    geojson: { type: 'LineString', coordinates: [[-52.1, -32], [-52.2, -32.1]] },
    style: { color: '#F97316' },
  },
  {
    id: 'g1',
    name: 'Área',
    element_type: 'polygon',
    element_category: 'terra',
    geojson: {
      type: 'Polygon',
      coordinates: [[
        [-52.12, -32.03],
        [-52.08, -32.03],
        [-52.08, -32.05],
        [-52.12, -32.05],
        [-52.12, -32.03],
      ]],
    },
    style: { fill_color: '#FED7AA', border_color: '#F97316' },
  },
];

function renderDialog(props = {}) {
  const fetchElements = props.fetchElements ?? vi.fn(async () => elements);
  return render(
    <GisExportDialog
      open
      onOpenChange={vi.fn()}
      mapId="map-1"
      mapName="Mapa Costeiro"
      elements={elements}
      fetchElements={fetchElements}
      exportGeoJson={props.exportGeoJson ?? vi.fn()}
      exportShp={props.exportShp ?? vi.fn()}
      {...props}
    />,
  );
}

describe('GisExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOnline.mockReturnValue(true);
  });

  it('UT-120: whole map + GeoJSON enables continue when there are elements', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('gis-export-confirm')).toBeEnabled());
    expect(screen.getByLabelText('Mapa inteiro')).toBeChecked();
    expect(screen.getByLabelText('GeoJSON')).toBeChecked();
  });

  it('UT-121: whole map with zero elements disables continue', async () => {
    renderDialog({
      elements: [],
      fetchElements: vi.fn(async () => []),
    });
    await waitFor(() => expect(screen.getByTestId('no-elements-message')).toBeInTheDocument());
    expect(screen.getByTestId('gis-export-confirm')).toBeDisabled();
  });

  it('UT-122: shapefile is disabled offline', async () => {
    isOnline.mockReturnValue(false);
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('shapefile-requires-connection')).toBeInTheDocument());
    expect(screen.getByLabelText(/Shapefile/)).toBeDisabled();
  });

  it('offline GeoJSON uses local elements without fetching the server', async () => {
    isOnline.mockReturnValue(false);
    const fetchElements = vi.fn(async () => []);
    renderDialog({ fetchElements });
    await waitFor(() => expect(screen.getByTestId('gis-export-offline-note')).toBeInTheDocument());
    expect(fetchElements).not.toHaveBeenCalled();
    expect(screen.getByTestId('gis-export-confirm')).toBeEnabled();
  });

  it('UT-123: picker with zero checked disables continue', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('gis-export-confirm')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Seleção de elementos'));
    fireEvent.click(screen.getByTestId('gis-export-confirm'));
    await waitFor(() => expect(screen.getByTestId('gis-export-picker')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('gis-export-select-all'));
    expect(screen.getByTestId('gis-export-confirm')).toBeDisabled();
  });

  it('UT-124: confirm step lists shapefile layers for mixed geometry', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('gis-export-confirm')).toBeEnabled());
    fireEvent.click(screen.getByLabelText(/Shapefile/));
    fireEvent.click(screen.getByTestId('gis-export-confirm'));
    await waitFor(() => expect(screen.getByTestId('gis-export-layers')).toBeInTheDocument());
    expect(screen.getByText('Pontos')).toBeInTheDocument();
    expect(screen.getByText('Linhas')).toBeInTheDocument();
    expect(screen.getByText('Polígonos')).toBeInTheDocument();
  });

  it('UT-125: confirm downloads GeoJSON with slugified dated filename', async () => {
    const exportGeoJson = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ exportGeoJson, onOpenChange });
    await waitFor(() => expect(screen.getByTestId('gis-export-confirm')).toBeEnabled());
    fireEvent.click(screen.getByTestId('gis-export-confirm'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar' })).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('gis-export-confirm'));
    await waitFor(() => expect(exportGeoJson).toHaveBeenCalled());
    const [, fileName] = exportGeoJson.mock.calls[0];
    expect(fileName).toMatch(/^mapa-costeiro-\d{4}-\d{2}-\d{2}\.geojson$/);
    expect(toast.success).toHaveBeenCalled();
  });

  it('keeps pending local elements in the GeoJSON download after the server fetch', async () => {
    const pending = {
      id: 'pending-1',
      name: 'Pendente',
      element_type: 'point',
      element_category: 'terra',
      geojson: { type: 'Point', coordinates: [-51, -31] },
      style: { icon_name: 'pin' },
      _pending: true,
    };
    const exportGeoJson = vi.fn();
    renderDialog({
      elements: [...elements, pending],
      fetchElements: vi.fn(async () => elements),
      exportGeoJson,
    });
    await waitFor(() => expect(screen.getByTestId('gis-export-confirm')).toBeEnabled());
    fireEvent.click(screen.getByTestId('gis-export-confirm'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar' })).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('gis-export-confirm'));
    await waitFor(() => expect(exportGeoJson).toHaveBeenCalled());
    const [collection] = exportGeoJson.mock.calls[0];
    expect(collection.features).toHaveLength(4);
    expect(collection.features.some((feature) => feature.properties.name === 'Pendente')).toBe(true);
  });
});
