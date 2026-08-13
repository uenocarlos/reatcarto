import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  assertExportTitle,
  clampLegendColumns,
  countLegendSymbolItems,
  legendItemsFromSession,
  truncateTitleForPreview,
  validateLocationSelection,
} from '@/lib/export';
import ExportMainMap from './ExportMainMap';
import ExportLegend from './ExportLegend';
import ExportLocationInsets from './ExportLocationInsets';
import InstitutionalFooter from './InstitutionalFooter';
import './exportComposition.css';

function describeCollisions(collisions, elements) {
  const roleLabel = { north: 'Norte', scale: 'Escala', legend: 'Legenda' };
  const namesById = new Map((elements ?? []).map((element) => [
    String(element.id),
    String(element.name || element.label || `item ${element.id}`),
  ]));
  const coveredByRole = new Map();
  const messages = [];

  collisions.forEach((collision) => {
    const [first, second, id] = collision.split(':');
    if (second === 'element') {
      if (!coveredByRole.has(first)) coveredByRole.set(first, new Set());
      coveredByRole.get(first).add(namesById.get(id) || `item ${id}`);
      return;
    }
    messages.push(`${roleLabel[first] || first} colide com ${String(roleLabel[second] || second).toLowerCase()}.`);
  });

  coveredByRole.forEach((names, role) => {
    messages.push(`${roleLabel[role] || role} cobre: ${[...names].join(', ')}.`);
  });
  return [...new Set(messages)];
}

export function deriveExportReadiness(session) {
  const titleResult = assertExportTitle(session.title);
  const locationResult = validateLocationSelection({
    locationCount: session.locationCount,
    locations: session.locations,
  });
  const geoBlocksExport = session.locationCount > 0 && Boolean(session.geoLoadError);

  return {
    canExport: titleResult.ok && locationResult.ok && !geoBlocksExport,
    titleResult,
    locationResult,
    geoBlocksExport,
  };
}

export default function CompositionPreview({
  session,
  onLegendInsideChange: _onLegendInsideChange,
  onLegendRightWidthChange,
  onLegendItemOrderChange,
  onChromeChange,
  onGeoLoadError,
  onViewChange,
  geoFeaturesOverride,
  fetchFn,
  showMetricControls = false,
  showExportTrigger = false,
  onExportClick,
  fixedDesktop = false,
  interactive = true,
  mapInteractive,
  interactionRotation = 0,
  rootTestId = 'export-composition-root',
}) {
  const rootRef = useRef(null);
  const mapPanZoom = mapInteractive ?? interactive;
  const [tilesReady, setTilesReady] = useState(false);
  const [collisions, setCollisions] = useState([]);
  const collisionMessages = useMemo(
    () => describeCollisions(collisions, session.elements),
    [collisions, session.elements],
  );

  const legendItems = useMemo(
    () => legendItemsFromSession(session),
    [
      session.elements,
      session.hiddenIds,
      session.locations,
      session.locationCount,
      session.stateOnLegend,
      session.showMunicipalMesh,
      session.brasilColor,
      session.stateColor,
      session.municipioColor,
      session.legendItemOrder,
      session.legendGroupByTopic,
      session.elementCategories,
    ],
  );
  const legendColumns = clampLegendColumns(
    session.legendColumns,
    countLegendSymbolItems(legendItems),
  );

  const readiness = deriveExportReadiness(session);
  const orientationClass = session.orientation === 'portrait'
    ? 'export-composition--portrait'
    : 'export-composition--landscape';
  const legendPosition = session.legendPosition === 'inside' ? 'right' : session.legendPosition;
  const showLegendRegion = legendPosition === 'bottom' || legendPosition === 'right';
  const showLocationInsets = session.locationCount > 0;
  const locationPlacement = legendPosition === 'right' ? 'bottom' : 'side';
  const fitRightLegend = legendPosition === 'right';

  const locationInsetsProps = {
    locationCount: session.locationCount,
    locations: session.locations,
    showMunicipalMesh: session.showMunicipalMesh,
    brasilColor: session.brasilColor,
    stateColor: session.stateColor,
    municipioColor: session.municipioColor,
    onGeoLoadError,
    geoFeaturesOverride,
    fetchFn,
  };

  const handleTilesReady = useCallback((ready) => {
    setTilesReady(Boolean(ready));
  }, []);

  const handleCollisionChange = useCallback((nextCollisions) => {
    setCollisions(nextCollisions);
  }, []);

  void _onLegendInsideChange;

  return (
    <div
      ref={rootRef}
      className={[
        'export-composition',
        orientationClass,
        `export-composition--paper-${session.paper}`,
        fixedDesktop ? 'export-composition--fixed-desktop' : '',
      ].filter(Boolean).join(' ')}
      data-testid={rootTestId}
      data-orientation={session.orientation}
      data-can-export={readiness.canExport ? 'true' : 'false'}
      data-tiles-ready={tilesReady ? 'true' : 'false'}
    >
      <div className="export-composition__title" data-testid="export-composition-title">
        {truncateTitleForPreview(session.title)}
      </div>

      <div
        className={[
          `export-composition__body export-composition__body--legend-${legendPosition}`,
          fitRightLegend ? 'export-composition__body--legend-right-fit' : '',
        ].filter(Boolean).join(' ')}
      >
        <div
          className={[
            'export-composition__map-column',
            showLocationInsets ? `export-composition__map-column--with-insets-${locationPlacement}` : '',
          ].filter(Boolean).join(' ')}
        >
          <div
            className={[
              'export-composition__main-map-region',
              showLocationInsets && locationPlacement === 'side' ? 'export-composition__main-map-region--with-insets-side' : '',
              legendPosition === 'right' ? 'export-composition__main-map-region--legend-right' : '',
            ].filter(Boolean).join(' ')}
          >
            <div className="export-composition__main-map-cell">
              <ExportMainMap
                center={session.center}
                zoom={session.zoom}
                elements={session.elements}
                hiddenIds={session.hiddenIds}
                basemap={session.basemap}
                showLabels={session.showLabels}
                locationCount={session.locationCount}
                locations={session.locations}
                showMunicipalMesh={session.showMunicipalMesh}
                stateOnLegend={session.stateOnLegend}
                stateColor={session.stateColor}
                municipioColor={session.municipioColor}
                northPosition={session.northPosition}
                northSizePx={session.northSizePx}
                scalePosition={session.scalePosition}
                scaleSizePx={session.scaleSizePx}
                interactive={mapPanZoom}
                onChromeChange={interactive ? onChromeChange : undefined}
                onCollisionChange={handleCollisionChange}
                onViewChange={onViewChange}
                onTilesReadyChange={handleTilesReady}
                onGeoLoadError={onGeoLoadError}
                fetchFn={fetchFn}
                interactionRotation={interactionRotation}
              />

              {collisionMessages.length > 0 ? (
                <div
                  className="export-collision-warning"
                  data-testid="export-collision-warning"
                  data-export-exclude="true"
                  role="status"
                  aria-live="polite"
                >
                  {collisionMessages.map((message) => <span key={message}>{message}</span>)}
                </div>
              ) : null}
            </div>

            {showLocationInsets && locationPlacement === 'side' ? (
              <ExportLocationInsets {...locationInsetsProps} placement="side" />
            ) : null}

          </div>

          {showLocationInsets && locationPlacement === 'bottom' ? (
            <ExportLocationInsets {...locationInsetsProps} placement="bottom" />
          ) : null}
        </div>

        {legendPosition === 'right' && showLegendRegion ? (
          <ExportLegend
            items={legendItems}
            legendPosition="right"
            legendColumns={legendColumns}
            legendFontPx={session.legendFontPx}
            legendSpacing={session.legendSpacing}
            legendRightWidthPct={session.legendRightWidthPct}
            onLegendRightWidthChange={interactive && !fitRightLegend ? onLegendRightWidthChange : undefined}
            onLegendItemOrderChange={interactive ? onLegendItemOrderChange : undefined}
            showMetricControls={interactive && showMetricControls && !fitRightLegend}
          />
        ) : null}

        {legendPosition === 'bottom' && showLegendRegion ? (
          <ExportLegend
            items={legendItems}
            legendPosition="bottom"
            legendColumns={legendColumns}
            legendFontPx={session.legendFontPx}
            legendSpacing={session.legendSpacing}
          />
        ) : null}
      </div>

      {!readiness.locationResult.ok && session.locationCount > 0 ? (
        <div className="export-composition__selection-warning" data-testid="export-selection-incomplete">
          Selecao de localizacao incompleta. Escolha a UF antes de exportar.
        </div>
      ) : null}

      {session.geoLoadError && session.locationCount > 0 ? (
        <div className="export-composition__geo-error" data-testid="export-geo-error" role="alert">
          {session.geoLoadError}
        </div>
      ) : null}

      <InstitutionalFooter
        authorship={session.authorship}
        technicalResponsible={session.technicalResponsible}
      />

      {showExportTrigger ? (
        <button
          type="button"
          data-testid="export-generate-trigger"
          disabled={!readiness.canExport}
          onClick={onExportClick}
        >
          Exportar
        </button>
      ) : null}
    </div>
  );
}
