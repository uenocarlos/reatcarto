import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MemorialDialog from '@/components/map/MemorialDialog';
import { saveMemorialPdf } from '@/lib/memorial/generateMemorialPdf';

vi.mock('@/lib/memorial/generateMemorialPdf', () => ({
  saveMemorialPdf: vi.fn(() => ({
    fileName: 'memorial-mapa-costeiro.pdf',
    mimeType: 'application/pdf',
  })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const polygon = {
  id: 'area-1',
  name: 'Área Norte',
  description: 'Trecho costeiro',
  element_type: 'polygon',
  geojson: {
    type: 'Polygon',
    coordinates: [[
      [-52.101, -32.001],
      [-52.099, -32.001],
      [-52.099, -31.999],
      [-52.101, -31.999],
      [-52.101, -32.001],
    ]],
  },
};

describe('MemorialDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows polygon metadata and generates its PDF', () => {
    const onOpenChange = vi.fn();
    render(
      <MemorialDialog
        open
        onOpenChange={onOpenChange}
        elements={[polygon, { id: 'point-1', element_type: 'point' }]}
        mapName="Mapa Costeiro"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Memorial descritivo' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Área Norte/)).toBeChecked();
    expect(screen.getByText('UTM 22S')).toBeInTheDocument();
    expect(screen.getByText('Trecho costeiro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' }));

    expect(saveMemorialPdf).toHaveBeenCalledWith(expect.objectContaining({
      mapName: 'Mapa Costeiro',
      polygonName: 'Área Norte',
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('explains that a polygon is required', () => {
    render(<MemorialDialog open onOpenChange={() => {}} elements={[]} mapName="Mapa vazio" />);
    expect(screen.getByText(/ainda não possui polígonos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar PDF' })).toBeDisabled();
  });
});
