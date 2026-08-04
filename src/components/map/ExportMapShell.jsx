import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import CompositionPreview from '@/components/map/export/CompositionPreview';
import ExportControlsPanel from '@/components/map/export/ExportControlsPanel';
import {
  assertExportTitle,
  createDefaultExportSession,
  createPreviewSync,
  generateExport,
  setLegendInside,
  setMapChrome,
} from '@/lib/export';
import '@/components/map/export/exportShell.css';

let defaultGenerateDepsPromise = null;

function loadDefaultGenerateDeps() {
  if (!defaultGenerateDepsPromise) {
    defaultGenerateDepsPromise = Promise.all([
      import('html-to-image'),
      import('jspdf'),
    ]).then(([capture, pdf]) => ({ toPng: capture.toPng, jsPDF: pdf.jsPDF }));
  }
  return defaultGenerateDepsPromise;
}

const EMPTY_TITLE_MESSAGE = 'Informe um título para exportar o mapa.';

const GENERATION_ERROR_MESSAGES = {
  memory: 'Falha na exportação por memória insuficiente. Tente reduzir o DPI ou simplificar o layout.',
  tiles: 'O mapa base ainda não terminou de carregar. Aguarde a prévia ou tente novamente.',
  capture: 'Não foi possível capturar o mapa. Tente novamente.',
  validation: EMPTY_TITLE_MESSAGE,
  aborted: '',
};

/**
 * Ephemeral export composition shell (ADR-003, ADR-010, ADR-008).
 */
export default function ExportMapShell({
  open,
  onOpenChange,
  snapshot,
  generateDeps = null,
  fetchFn,
  geoFeaturesOverride,
}) {
  const compositionRef = useRef(null);
  const previewSyncRef = useRef(null);
  const abortRef = useRef(null);
  const generatingRef = useRef(false);

  const [draftSession, setDraftSession] = useState(() => createDefaultExportSession(snapshot));
  const [previewSession, setPreviewSession] = useState(() => createDefaultExportSession(snapshot));
  const [titleError, setTitleError] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  useEffect(() => {
    previewSyncRef.current = createPreviewSync((value) => {
      setPreviewSession(value);
    });
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (open && !generateDeps) loadDefaultGenerateDeps().catch(() => {});
  }, [generateDeps, open]);

  const updateSession = useCallback((updater) => {
    setDraftSession((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      previewSyncRef.current?.schedule(next);
      return next;
    });
  }, []);

  const handleRefreshPreview = useCallback(() => {
    previewSyncRef.current?.flushPreviewSync();
    setPreviewSession(draftSession);
  }, [draftSession]);

  const handleClose = useCallback((nextOpen) => {
    if (nextOpen) return;
    abortRef.current?.abort();
    abortRef.current = null;
    generatingRef.current = false;
    onOpenChange(false);
  }, [onOpenChange]);

  const handleExport = useCallback(async () => {
    if (generatingRef.current) return;

    const titleCheck = assertExportTitle(draftSession.title);
    if (!titleCheck.ok) {
      setTitleError(EMPTY_TITLE_MESSAGE);
      return;
    }
    setTitleError(null);
    setGenerationError(null);

    previewSyncRef.current?.flushPreviewSync();
    setPreviewSession(draftSession);

    const compositionEl = compositionRef.current?.querySelector('[data-testid="export-composition-root"]');
    if (!compositionEl) {
      setGenerationError(GENERATION_ERROR_MESSAGES.capture);
      return;
    }

    generatingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    setDraftSession((prev) => ({ ...prev, isGenerating: true, generationError: null }));

    try {
      const resolvedGenerateDeps = generateDeps ?? await loadDefaultGenerateDeps();
      await generateExport(
        {
          compositionEl,
          format: draftSession.format,
          dpi: draftSession.dpi,
          paper: draftSession.paper,
          orientation: draftSession.orientation,
          fileTitle: draftSession.title,
          signal: controller.signal,
        },
        resolvedGenerateDeps,
      );
    } catch (error) {
      if (error?.code !== 'aborted') {
        const message = GENERATION_ERROR_MESSAGES[error?.code] || GENERATION_ERROR_MESSAGES.capture;
        setGenerationError(message);
      }
    } finally {
      generatingRef.current = false;
      abortRef.current = null;
      setDraftSession((prev) => ({ ...prev, isGenerating: false }));
    }
  }, [draftSession, generateDeps]);

  const handleLegendInsideChange = useCallback((metrics) => {
    // Commit layout immediately to preview (bypass debounce) so drag stays fluid.
    setDraftSession((prev) => {
      const next = setLegendInside(prev, metrics);
      setPreviewSession(next);
      previewSyncRef.current?.schedule(next);
      return next;
    });
  }, []);

  const handleLegendRightWidthChange = useCallback((legendRightWidthPct) => {
    setDraftSession((prev) => {
      const next = { ...prev, legendRightWidthPct };
      setPreviewSession(next);
      previewSyncRef.current?.schedule(next);
      return next;
    });
  }, []);

  const handleLegendItemOrderChange = useCallback((legendItemOrder) => {
    updateSession((prev) => ({ ...prev, legendItemOrder }));
  }, [updateSession]);

  const handleChromeChange = useCallback((control, values) => {
    setDraftSession((prev) => {
      const next = setMapChrome(prev, control, {
        sizePx: values.sizePx,
        xPct: values.position?.xPct,
        yPct: values.position?.yPct,
      });
      setPreviewSession(next);
      previewSyncRef.current?.schedule(next);
      return next;
    });
  }, []);

  const handleGeoLoadError = useCallback((geoLoadError) => {
    updateSession((prev) => ({ ...prev, geoLoadError }));
  }, [updateSession]);

  const handleViewChange = useCallback((view) => {
    updateSession((prev) => ({
      ...prev,
      center: view.center ?? prev.center,
      zoom: view.zoom ?? prev.zoom,
    }));
  }, [updateSession]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="export-shell-dialog sm:max-w-[min(98vw,1600px)]"
        data-testid="export-map-shell"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="export-shell__header space-y-0">
          <DialogTitle>Exportar mapa</DialogTitle>
          <DialogDescription className="sr-only">
            Configure a composicao cartografica, revise a previa e baixe o mapa em PNG ou PDF.
          </DialogDescription>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefreshPreview}
            data-testid="export-preview-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Atualizar prévia
          </Button>
        </DialogHeader>

        <div className="export-shell__body">
          <aside className="export-shell__controls">
            <ExportControlsPanel
              session={draftSession}
              onSessionChange={updateSession}
              titleError={titleError}
            />
          </aside>

          <div className="export-shell__preview" data-testid="export-preview-panel">
            <div className="export-shell__preview-inner" ref={compositionRef}>
              <CompositionPreview
                session={previewSession}
                onLegendInsideChange={handleLegendInsideChange}
                onLegendRightWidthChange={handleLegendRightWidthChange}
                onLegendItemOrderChange={handleLegendItemOrderChange}
                onChromeChange={handleChromeChange}
                onGeoLoadError={handleGeoLoadError}
                onViewChange={handleViewChange}
                fetchFn={fetchFn}
                geoFeaturesOverride={geoFeaturesOverride}
                showMetricControls
              />
            </div>
          </div>
        </div>

        <div className="export-shell__footer">
          <div className="flex flex-col gap-1 min-w-0">
            {draftSession.isGenerating ? (
              <span className="export-shell__progress" data-testid="export-progress">
                Gerando arquivo…
              </span>
            ) : null}
            {generationError ? (
              <span className="export-shell__error" data-testid="export-generation-error" role="alert">
                {generationError}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              data-testid="export-cancel-button"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={draftSession.isGenerating}
              data-testid="export-download-button"
            >
              Exportar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { EMPTY_TITLE_MESSAGE, GENERATION_ERROR_MESSAGES };
