import React, { useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import PreviewMap from './PreviewMap';
import LegendFrame from './LegendFrame';
import InstitutionalFooter from './InstitutionalFooter';
import LocationInsets from './LocationInsets';
import { buildPreviewModel } from '@/lib/export/previewModel';
import { wrapTitleLines } from '@/lib/export/compositionMetadata';

export default function CompositionPreview({
  settings,
  elements,
  previewRef,
  onLegendRectChange,
  onBasemapReadinessChange,
  boundaryLoading = false,
  boundaryResult = null,
  boundaryError = false,
  locationLabels = {},
  basemapReadiness,
}) {
  const mapContainerRef = useRef(null);
  const isNative = Capacitor.isNativePlatform();

  const model = useMemo(
    () =>
      buildPreviewModel({
        settings,
        elements,
        isNativePlatform: isNative,
        boundaryLoading,
        boundaryResult,
        boundaryError,
        locationLabels,
        basemapReadiness,
        baseWidthPx: 640,
      }),
    [settings, elements, isNative, boundaryLoading, boundaryResult, boundaryError, locationLabels, basemapReadiness]
  );

  const titleLines = model.headerTitle ? wrapTitleLines(model.headerTitle, 60) : [];
  const layout = model.compositionLayout;
  const paperAspect = model.paperFrame.aspect;
  const previewAspect = layout.legendOutsideMap
    ? layout.totalWidth / layout.totalHeight
    : paperAspect;
  const flexDirection =
    model.legendLayoutMode === 'beside' ? 'row' : model.legendLayoutMode === 'below' ? 'column' : 'row';

  return (
    <div
      ref={previewRef}
      className="flex flex-col border-2 border-amber-500 bg-white overflow-hidden min-h-0"
      data-testid="composition-preview"
      data-preview-status={model.previewStatus}
      data-settings-hash={model.settingsHash}
      data-composition-aspect={String(previewAspect)}
      data-legend-outside-map={layout.legendOutsideMap ? 'true' : 'false'}
      style={{
        aspectRatio: String(previewAspect),
        maxHeight: '100%',
      }}
    >
      {titleLines.length > 0 && (
        <div className="text-center py-1 border-b text-xs font-bold flex-shrink-0 bg-white" data-testid="export-header-title">
          {titleLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      <div
        className="flex-1 flex min-h-0 overflow-hidden relative"
        style={{ flexDirection }}
        data-testid="composition-layout"
        data-layout-mode={model.legendLayoutMode}
      >
        <div
          ref={mapContainerRef}
          className="flex-1 relative min-w-0 min-h-0 border-[3px] border-amber-500 m-1 sm:m-2"
          data-testid="composition-map-frame"
          data-map-aspect={String(paperAspect)}
          style={
            layout.legendOutsideMap
              ? {
                  flex: '0 1 auto',
                  aspectRatio: String(paperAspect),
                  width: model.legendLayoutMode === 'below' ? '100%' : undefined,
                }
              : {
                  flex: model.legendLayoutMode === 'beside' ? '1 1 auto' : undefined,
                  width: model.legendLayoutMode === 'below' ? '100%' : undefined,
                }
          }
        >
          <PreviewMap
            elements={model.visibleElements}
            basemap={model.basemap}
            tileUrl={model.tileUrl}
            tagDescriptors={model.tagDescriptors}
            locationOverlay={model.locationOverlay}
            onBasemapReadinessChange={onBasemapReadinessChange}
          />
          <LocationInsets
            descriptors={model.locatorInsets}
            municipalityColor={model.settings.municipalityColor}
            stateColor={model.settings.stateColor}
          />
          {model.legendLayoutMode === 'inside' && (
            <LegendFrame
              layoutMode="inside"
              legendRect={model.legendRect}
              legendItems={model.legendItems}
              columns={model.legendGrid.columns}
              fontSizePx={model.legendGrid.fontSizePx}
              spacing={model.legendGrid.spacing}
              onLegendRectChange={onLegendRectChange}
              containerRef={mapContainerRef}
            />
          )}
        </div>

        {(model.legendLayoutMode === 'beside' || model.legendLayoutMode === 'below') && (
          <LegendFrame
            layoutMode={model.legendLayoutMode}
            legendItems={model.legendItems}
            columns={model.legendGrid.columns}
            fontSizePx={model.legendGrid.fontSizePx}
            spacing={model.legendGrid.spacing}
          />
        )}
      </div>

      <InstitutionalFooter settings={model.settings} boundaryMeta={model.institutionalFooter} />

      <span className="sr-only" data-testid="export-chrome-flags">
        {JSON.stringify(model.chrome)}
      </span>
    </div>
  );
}
