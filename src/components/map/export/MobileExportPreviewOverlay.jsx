import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CompositionPreview from './CompositionPreview';
import { getFixedCompositionStyle, getFixedCompositionWidth } from '@/lib/export/compositionDimensions';
import {
  isPortraitViewport,
  lockScreenOrientation,
  unlockScreenOrientation,
} from '@/lib/deviceViewport';

function computePreviewTransform({
  viewportWidth,
  viewportHeight,
  compositionWidth,
  compositionHeight,
  rotateForPortrait = false,
}) {
  const toolbarReserve = 64;
  const hintReserve = 28;
  const padding = 12;
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - toolbarReserve - hintReserve - padding * 2);

  if (rotateForPortrait) {
    const scale = Math.min(
      availableWidth / compositionHeight,
      availableHeight / compositionWidth,
      1,
    );
    return { scale, rotated: true };
  }

  const scale = Math.min(
    availableWidth / compositionWidth,
    availableHeight / compositionHeight,
    1,
  );
  return { scale, rotated: false };
}

export default function MobileExportPreviewOverlay({
  session,
  captureRef,
  onClose,
  onExport,
  onViewChange,
  isGenerating = false,
  generationError = null,
  fetchFn,
  geoFeaturesOverride,
}) {
  const stageRef = useRef(null);
  const compositionMeasureRef = useRef(null);
  const [transform, setTransform] = useState({ scale: 0.5, rotated: false });
  const [portraitViewport, setPortraitViewport] = useState(() => isPortraitViewport());

  const compositionWidth = getFixedCompositionWidth(session);
  const compositionStyle = useMemo(() => getFixedCompositionStyle(session), [session.orientation]);

  const updateTransform = () => {
    const stage = stageRef.current;
    const composition = compositionMeasureRef.current;
    if (!stage || !composition) return;

    const compositionHeight = composition.offsetHeight || compositionWidth * 0.75;
    const rotateForPortrait = portraitViewport;
    setTransform(computePreviewTransform({
      viewportWidth: stage.clientWidth,
      viewportHeight: stage.clientHeight,
      compositionWidth,
      compositionHeight,
      rotateForPortrait,
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const applyLandscapeLock = async () => {
      unlockScreenOrientation();
      const locked = await lockScreenOrientation('landscape');
      if (cancelled) return;
      if (locked) {
        setPortraitViewport(false);
      } else {
        setPortraitViewport(isPortraitViewport());
      }
    };

    applyLandscapeLock();

    const onViewportChange = () => setPortraitViewport(isPortraitViewport());
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      unlockScreenOrientation();
      lockScreenOrientation('portrait-primary');
    };
  }, []);

  useEffect(() => {
    updateTransform();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => updateTransform());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [session, compositionWidth, portraitViewport]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => updateTransform());
    return () => cancelAnimationFrame(frame);
  }, [
    session.title,
    session.orientation,
    session.legendPosition,
    session.paper,
    session.format,
    session.basemap,
    session.locationCount,
    session.center?.lat,
    session.center?.lng,
    session.zoom,
  ]);

  const transformCss = transform.rotated
    ? `rotate(90deg) scale(${transform.scale})`
    : `scale(${transform.scale})`;

  const interactionRotation = transform.rotated ? 90 : 0;

  return (
    <div
      className="export-mobile-preview-overlay export-mobile-preview-overlay--interactive"
      data-testid="export-mobile-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar e exportar mapa"
    >
      <div className="export-mobile-preview-overlay__toolbar">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-white hover:text-white hover:bg-white/10"
          onClick={onClose}
          disabled={isGenerating}
          data-testid="export-mobile-preview-back"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onExport}
          disabled={isGenerating}
          data-testid="export-mobile-preview-export"
        >
          <Download className="w-4 h-4 mr-1" />
          Exportar
        </Button>
      </div>

      <p className="export-mobile-preview-overlay__hint" data-testid="export-mobile-preview-hint">
        Arraste o mapa e use pinça para ajustar o enquadramento.
      </p>

      {generationError ? (
        <p className="export-mobile-preview-overlay__error" role="alert" data-testid="export-mobile-preview-error">
          {generationError}
        </p>
      ) : null}

      <div className="export-mobile-preview-overlay__stage" ref={stageRef}>
        <div
          className={`export-mobile-preview-overlay__composition-wrap${transform.rotated ? ' export-mobile-preview-overlay__composition-wrap--rotated' : ''}`}
          style={{ transform: transformCss }}
        >
          <div
            ref={(node) => {
              compositionMeasureRef.current = node;
              if (typeof captureRef === 'function') captureRef(node);
              else if (captureRef) captureRef.current = node;
            }}
            className="export-mobile-preview-overlay__composition export-composition-host--fixed-desktop"
            style={compositionStyle}
          >
            <CompositionPreview
              session={session}
              fetchFn={fetchFn}
              geoFeaturesOverride={geoFeaturesOverride}
              fixedDesktop
              interactive={false}
              mapInteractive
              interactionRotation={interactionRotation}
              onViewChange={onViewChange}
              rootTestId="export-mobile-preview-root"
            />
          </div>
        </div>
      </div>

      {isGenerating ? (
        <p className="export-mobile-preview-overlay__progress" data-testid="export-mobile-preview-progress">
          Gerando arquivo…
        </p>
      ) : null}
    </div>
  );
}
