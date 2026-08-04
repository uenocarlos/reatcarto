import React, { useCallback, useMemo, useState } from 'react';
import {
  assertExportTitle,
  buildLegendItems,
  truncateTitleForPreview,
  validateLocationSelection,
} from '@/lib/export';
import ExportMainMap from './ExportMainMap';
import ExportLegend from './ExportLegend';
import ExportLocationInsets from './ExportLocationInsets';
import InstitutionalFooter from './InstitutionalFooter';
import './exportComposition.css';

function buildLocationLegendInput({
  locations,
  locationCount,
  stateOnLegend,
  showMunicipalMesh,
  stateColor,
  municipioColor,
}) {
  if (locationCount === 0) return null;
  const first = locations?.[0];
  if (!first?.uf) return null;

  const result = {
    stateColor,
    municipioColor,
  };

  if (stateOnLegend) result.stateLabel = first.stateName || first.uf;
  if (showMunicipalMesh) {
    result.municipioLabel = first.municipioName || 'Malha municipal';
  }

  if (stateOnLegend || showMunicipalMesh) {
    result.topicLabel = 'Convencoes cartograficas';
  }

  if (!result.stateLabel && !result.municipioLabel) return null;
  return result;
}

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
  onLegendInsideChange,
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
}) {
  const [tilesReady, setTilesReady] = useState(false);
  const [collisions, setCollisions] = useState([]);
  const collisionMessages = useMemo(
    () => describeCollisions(collisions, session.elements),
    [collisions, session.elements],
  );

  const locationLegend = buildLocationLegendInput({
    locations: session.locations,
    locationCount: session.locationCount,
    stateOnLegend: session.stateOnLegend,
    showMunicipalMesh: session.showMunicipalMesh,
    stateColor: session.stateColor,
    municipioColor: session.municipioColor,
  });

  const legendItems = useMemo(
    () => buildLegendItems({
      elements: session.elements,
      hiddenIds: session.hiddenIds,
      location: locationLegend,
      order: session.legendItemOrder,
      groupByTopic: session.legendGroupByTopic,
    }),
    [
      session.elements,
      session.hiddenIds,
      locationLegend,
      session.legendItemOrder,
      session.legendGroupByTopic,
    ],
  );

  const readiness = deriveExportReadiness(session);
  const orientationClass = session.orientation === 'portrait'
    ? 'export-composition--portrait'
    : 'export-composition--landscape';
  const showLegendRegion = session.legendPosition === 'bottom'
    || session.legendPosition === 'right'
    || (session.legendPosition === 'inside' && legendItems.length > 0);
  const showLocationInsets = session.locationCount > 0;
  const locationPlacement = session.legendPosition === 'right' ? 'bottom' : 'side';
  const rightLegendMinWidth = Math.max(160, session.legendColumns * 120);

  const locationInsetsProps = {
    locationCount: session.locationCount,
    locations: session.locations,
    showMunicipalMesh: session.showMunicipalMesh,
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

  return (
    <div
      className={`export-composition ${orientationClass} export-composition--paper-${session.paper}`}
      data-testid="export-composition-root"
      data-orientation={session.orientation}
      data-can-export={readiness.canExport ? 'true' : 'false'}
      data-tiles-ready={tilesReady ? 'true' : 'false'}
    >
      <div className="export-composition__title" data-testid="export-composition-title">
        {truncateTitleForPreview(session.title)}
      </div>

      <div
        className={`export-composition__body export-composition__body--legend-${session.legendPosition}`}
        style={session.legendPosition === 'right'
          ? { '--export-legend-side-min-width': `${rightLegendMinWidth}px` }
          : undefined}
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
              session.legendPosition === 'right' ? 'export-composition__main-map-region--legend-right' : '',
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
                interactive
                onChromeChange={onChromeChange}
                onCollisionChange={handleCollisionChange}
                onViewChange={onViewChange}
                onTilesReadyChange={handleTilesReady}
                onGeoLoadError={onGeoLoadError}
                fetchFn={fetchFn}
              />

              {session.legendPosition === 'inside' && showLegendRegion ? (
                <ExportLegend
                  items={legendItems}
                  legendPosition="inside"
                  legendColumns={session.legendColumns}
                  legendFontPx={session.legendFontPx}
                  legendSpacing={session.legendSpacing}
                  legendInside={session.legendInside}
                  onLegendInsideChange={onLegendInsideChange}
                  onLegendItemOrderChange={onLegendItemOrderChange}
                  showMetricControls={showMetricControls}
                />
              ) : null}

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

        {session.legendPosition === 'right' && showLegendRegion ? (
          <ExportLegend
            items={legendItems}
            legendPosition="right"
            legendColumns={session.legendColumns}
            legendFontPx={session.legendFontPx}
            legendSpacing={session.legendSpacing}
            legendRightWidthPct={session.legendRightWidthPct}
            onLegendRightWidthChange={onLegendRightWidthChange}
            onLegendItemOrderChange={onLegendItemOrderChange}
            showMetricControls={showMetricControls}
          />
        ) : null}

        {session.legendPosition === 'bottom' && showLegendRegion ? (
          <ExportLegend
            items={legendItems}
            legendPosition="bottom"
            legendColumns={session.legendColumns}
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
