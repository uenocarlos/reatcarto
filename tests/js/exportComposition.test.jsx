import React, { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CompositionPreview, { deriveExportReadiness } from '@/components/map/export/CompositionPreview';
import {
  createDefaultExportSession,
  createEditorExportSnapshot,
  setLegendInside,
} from '@/lib/export/session';
import { resetGeoBoundariesCache } from '@/lib/export/geoBoundaries';

function sampleElement(id, name) {
  return {
    id,
    name,
    element_type: 'point',
    geojson: JSON.stringify({ type: 'Point', coordinates: [-51.2, -30.1] }),
    style: JSON.stringify({ icon_color: '#ff0000' }),
  };
}

function CompositionHarness({ initialSession, ...props }) {
  const [session, setSession] = useState(initialSession);

  return (
    <CompositionPreview
      session={session}
      showMetricControls
      showExportTrigger
      onLegendInsideChange={(metrics) => setSession((prev) => setLegendInside(prev, metrics))}
      onLegendRightWidthChange={(legendRightWidthPct) => setSession((prev) => ({ ...prev, legendRightWidthPct }))}
      onGeoLoadError={(geoLoadError) => setSession((prev) => ({ ...prev, geoLoadError }))}
      onExportClick={() => props.onExportClick?.(session)}
      {...props}
    />
  );
}

describe('export composition integration', () => {
  beforeEach(() => {
    resetGeoBoundariesCache();
  });

  it('IT-018: legend bottom placement and empty thematic legend without crash', () => {
    const snapshot = createEditorExportSnapshot({
      mapName: 'Mapa teste',
      elements: [sampleElement('e1', 'Camada A'), sampleElement('e2', 'Camada B')],
    });
    const session = {
      ...createDefaultExportSession(snapshot),
      legendPosition: 'bottom',
      hiddenIds: new Set(['e1', 'e2']),
      title: 'Mapa teste',
    };

    expect(() => {
      render(<CompositionPreview session={session} />);
    }).not.toThrow();

    const legend = screen.getByTestId('export-legend');
    expect(legend).toHaveAttribute('data-legend-position', 'bottom');
    expect(screen.queryAllByTestId('export-legend-item')).toHaveLength(0);
  });

  it('IT-019: multi-column right legend fits content without wrapping', () => {
    const snapshot = createEditorExportSnapshot({
      mapName: 'Mapa',
      elements: [sampleElement('e1', 'Ponto A'), sampleElement('e2', 'Ponto B longo')],
    });
    const base = {
      ...createDefaultExportSession(snapshot),
      legendPosition: 'right',
      legendColumns: 2,
      title: 'Mapa',
    };

    render(<CompositionHarness initialSession={base} />);

    const legend = screen.getByTestId('export-legend');
    expect(legend).toHaveClass('export-legend--fit-content');
    expect(legend.closest('.export-composition__body')).toHaveClass('export-composition__body--legend-right-fit');
    expect(screen.queryByTestId('export-legend-resize-handle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-legend-width-input')).not.toBeInTheDocument();
  });

  it('IT-030: locationCount 2 shows two insets; 0 hides them', () => {
    const snapshot = createEditorExportSnapshot({ mapName: 'Loc' });
    const withTwo = {
      ...createDefaultExportSession(snapshot),
      title: 'Loc',
      locationCount: 2,
      locations: [
        { uf: 'RS', stateName: 'Rio Grande do Sul', municipioCode: '4314902', municipioName: 'Porto Alegre' },
        { uf: 'RS', stateName: 'Rio Grande do Sul', municipioCode: '4304606', municipioName: 'Canoas' },
      ],
    };
    const geoFeaturesOverride = {
      brasil: { type: 'FeatureCollection', features: [] },
      states: { type: 'FeatureCollection', features: [] },
      municipios: { type: 'FeatureCollection', features: [] },
    };

    const { rerender } = render(
      <CompositionPreview
        session={withTwo}
        geoFeaturesOverride={geoFeaturesOverride}
      />,
    );

    expect(screen.getByTestId('export-location-inset-0')).toBeInTheDocument();
    expect(screen.getByTestId('export-location-inset-1')).toBeInTheDocument();

    const overviewNorth = within(screen.getByTestId('export-location-inset-0')).getByTestId('export-north-control');
    const overviewScale = within(screen.getByTestId('export-location-inset-0')).getByTestId('export-scale-control');
    expect(overviewNorth.className).toContain('export-map-control--anchor-left');
    expect(overviewScale.className).toContain('export-map-control--anchor-left');
    expect(overviewNorth.className).not.toContain('export-map-control--anchor-right');
    expect(overviewScale.className).not.toContain('export-map-control--anchor-right');

    rerender(
      <CompositionPreview
        session={{ ...withTwo, locationCount: 0 }}
      />,
    );

    expect(screen.queryByTestId('export-location-inset-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-location-inset-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-location-insets')).not.toBeInTheDocument();
  });

  it('IT-031: geo load failure surfaces error; locationCount 0 still allows export', async () => {
    const snapshot = createEditorExportSnapshot({ mapName: 'Geo fail' });
    const session = {
      ...createDefaultExportSession(snapshot),
      title: 'Geo fail',
      locationCount: 1,
      locations: [{ uf: 'RS', municipioCode: null }],
    };

    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 }));
    const onExportClick = vi.fn();

    const { unmount: unmountFirst } = render(
      <CompositionHarness
        initialSession={session}
        fetchFn={fetchFn}
        onExportClick={onExportClick}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-geo-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('export-generate-trigger')).toBeDisabled();

    unmountFirst();

    const withoutInsets = { ...session, locationCount: 0, geoLoadError: null };
    const readiness = deriveExportReadiness(withoutInsets);
    expect(readiness.canExport).toBe(true);

    render(
      <CompositionHarness
        initialSession={withoutInsets}
        onExportClick={onExportClick}
      />,
    );

    fireEvent.click(screen.getByTestId('export-generate-trigger'));
    expect(onExportClick).toHaveBeenCalled();
  });

  it('IT-032: incomplete UF selection blocks export and shows message', () => {
    const snapshot = createEditorExportSnapshot({ mapName: 'Incomplete' });
    const session = {
      ...createDefaultExportSession(snapshot),
      title: 'Incomplete',
      locationCount: 1,
      locations: [{ uf: null, municipioCode: null }],
    };

    render(<CompositionHarness initialSession={session} />);

    expect(screen.getByTestId('export-selection-incomplete')).toBeInTheDocument();
    expect(screen.getByTestId('export-generate-trigger')).toBeDisabled();
  });

  it('IT-033: high-vertex mesh fixture mounts without uncaught throw', () => {
    const ring = Array.from({ length: 500 }, (_, index) => [
      -51 + index * 0.001,
      -30 + Math.sin(index / 20) * 0.05,
    ]);
    ring.push(ring[0]);

    const heavyMesh = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { id: '4314902', nome: 'Porto Alegre', uf: 'RS' },
        geometry: { type: 'Polygon', coordinates: [ring] },
      }],
    };

    const snapshot = createEditorExportSnapshot({ mapName: 'Mesh' });
    const session = {
      ...createDefaultExportSession(snapshot),
      title: 'Mesh',
      locationCount: 1,
      locations: [{ uf: 'RS', stateName: 'Rio Grande do Sul', municipioCode: '4314902', municipioName: 'Porto Alegre' }],
      showMunicipalMesh: true,
    };

    expect(() => {
      render(
        <CompositionPreview
          session={session}
          geoFeaturesOverride={{
            brasil: {
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: [ring.slice(0, 20)] },
              }],
            },
            states: {
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                properties: { SIGLA_UF: 'RS', CD_UF: '43', NM_UF: 'Rio Grande do Sul' },
                geometry: { type: 'Polygon', coordinates: [ring.slice(0, 20)] },
              }],
            },
            municipios: heavyMesh,
          }}
        />,
      );
    }).not.toThrow();

    expect(screen.getByTestId('export-location-inset-0')).toBeInTheDocument();
  });

  it('IT-040: chrome present and labels toggle does not remove chrome', () => {
    const snapshot = createEditorExportSnapshot({
      mapName: 'Chrome',
      elements: [sampleElement('e1', 'Ponto')],
    });

    const { rerender } = render(
      <CompositionPreview
        session={{ ...createDefaultExportSession(snapshot), title: 'Chrome', showLabels: false }}
      />,
    );

    expect(screen.getByTestId('export-scale-bar')).toBeInTheDocument();
    expect(screen.getByTestId('export-scale-bar').querySelectorAll('.export-scale-bar__seg')).toHaveLength(2);
    expect(screen.getByTestId('export-scale-bar').querySelectorAll('.export-scale-bar__ticks span')).toHaveLength(3);
    expect(screen.getByTestId('export-north-arrow')).toBeInTheDocument();
    expect(screen.getByTestId('export-graticule')).toBeInTheDocument();
    expect(screen.getByTestId('export-decorative-frame')).toBeInTheDocument();

    rerender(
      <CompositionPreview
        session={{ ...createDefaultExportSession(snapshot), title: 'Chrome', showLabels: true }}
      />,
    );

    expect(screen.getByTestId('export-scale-bar')).toBeInTheDocument();
    expect(screen.getByTestId('export-north-arrow')).toBeInTheDocument();
    expect(screen.getByTestId('export-graticule')).toBeInTheDocument();
    expect(screen.getByTestId('export-decorative-frame')).toBeInTheDocument();
  });

  it('IT-041: portrait composition keeps chrome inside composition root contract', () => {
    const snapshot = createEditorExportSnapshot({ mapName: 'Portrait' });
    render(
      <CompositionPreview
        session={{
          ...createDefaultExportSession(snapshot),
          title: 'Portrait',
          orientation: 'portrait',
        }}
      />,
    );

    const root = screen.getByTestId('export-composition-root');
    expect(root).toHaveClass('export-composition--portrait');
    expect(root).toContainElement(screen.getByTestId('export-map-chrome'));
    expect(root).toContainElement(screen.getByTestId('export-decorative-frame'));
    expect(root).toHaveAttribute('data-orientation', 'portrait');
  });

  it('IT-042: legend right moves location inset below the map', () => {
    const snapshot = createEditorExportSnapshot({ mapName: 'Layout' });
    render(
      <CompositionPreview
        session={{
          ...createDefaultExportSession(snapshot),
          title: 'Layout',
          legendPosition: 'right',
          locationCount: 1,
          locations: [{ uf: 'RS', stateName: 'Rio Grande do Sul', municipioCode: null, municipioName: null }],
        }}
      />,
    );

    expect(screen.getByTestId('export-location-insets')).toHaveAttribute('data-placement', 'bottom');
  });

  it('IT-043: legend bottom keeps location inset at map side', () => {
    const snapshot = createEditorExportSnapshot({ mapName: 'Layout' });
    render(
      <CompositionPreview
        session={{
          ...createDefaultExportSession(snapshot),
          title: 'Layout',
          legendPosition: 'bottom',
          locationCount: 1,
          locations: [{ uf: 'RS', stateName: 'Rio Grande do Sul', municipioCode: null, municipioName: null }],
        }}
      />,
    );

    expect(screen.getByTestId('export-location-insets')).toHaveAttribute('data-placement', 'side');
  });

  it('IT-044: right legend sits beside the map, not inside the map cell', () => {
    const snapshot = createEditorExportSnapshot({
      mapName: 'Layout seguro',
      elements: [sampleElement('e1', 'Ponto')],
    });
    render(
      <CompositionPreview
        session={{
          ...createDefaultExportSession(snapshot),
          title: 'Layout seguro',
          legendPosition: 'right',
          locationCount: 1,
          locations: [{ uf: 'RS', stateName: 'Rio Grande do Sul', municipioCode: null, municipioName: null }],
        }}
      />,
    );

    const legend = screen.getByTestId('export-legend');
    expect(legend).toHaveAttribute('data-legend-position', 'right');
    expect(legend.closest('.export-composition__main-map-cell')).toBeNull();
    expect(screen.getByTestId('export-location-insets')).toHaveAttribute('data-placement', 'bottom');
  });

  it('IT-045: one-column right legend fits content without wrapping labels', () => {
    const snapshot = createEditorExportSnapshot({
      mapName: 'Legenda justa',
      elements: [
        sampleElement('e1', 'Casa grande na praia'),
        sampleElement('e2', 'Elemento linear longo'),
      ],
    });
    render(
      <CompositionPreview
        session={{
          ...createDefaultExportSession(snapshot),
          title: 'Legenda justa',
          legendPosition: 'right',
          legendColumns: 1,
        }}
      />,
    );

    const legend = screen.getByTestId('export-legend');
    expect(legend).toHaveClass('export-legend--fit-content');
    expect(legend.closest('.export-composition__body')).toHaveClass('export-composition__body--legend-right-fit');
    expect(screen.queryByTestId('export-legend-resize-handle')).not.toBeInTheDocument();
    screen.getAllByTestId('export-legend-item').forEach((item) => {
      expect(item.querySelector('.export-legend__label')).toHaveTextContent(/./);
    });
  });

  it('IT-046: multi-column right legend also fits content without wrapping labels', () => {
    const snapshot = createEditorExportSnapshot({
      mapName: 'Legenda larga',
      elements: [sampleElement('e1', 'A'), sampleElement('e2', 'B')],
    });
    render(
      <CompositionPreview
        session={{
          ...createDefaultExportSession(snapshot),
          title: 'Legenda larga',
          legendPosition: 'right',
          legendColumns: 2,
        }}
        showMetricControls
        onLegendRightWidthChange={() => {}}
      />,
    );

    const legend = screen.getByTestId('export-legend');
    expect(legend).toHaveClass('export-legend--fit-content');
    expect(screen.queryByTestId('export-legend-resize-handle')).not.toBeInTheDocument();
  });
});
