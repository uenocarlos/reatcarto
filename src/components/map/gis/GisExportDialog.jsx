import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, MapPinned } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { isOnline } from '@/lib/offline/connectivity';
import { ApiError } from '@/api/http';
import { exportShapefile, fetchAllMapElements } from '@/api/gisClient';
import {
  buildFeatureCollection,
  exportGeoJsonToFile,
  GisExportError,
} from '@/lib/gis/exportGeoJson';
import { buildGisExportFileName } from '@/lib/gis/exportFileName';
import {
  collectShapefileTruncationWarnings,
  groupShapefileLayers,
} from '@/lib/gis/shapefileLayers';
import GisExportElementPicker from './GisExportElementPicker';

const STEPS = {
  options: 'options',
  picker: 'picker',
  confirm: 'confirm',
  downloading: 'downloading',
};

function overlayPendingElements(fetched = [], live = []) {
  const byId = new Map(fetched.map((el) => [String(el.id), el]));
  for (const el of live) {
    if (!el?.id) continue;
    const id = String(el.id);
    if (el._pending || el._queued || !byId.has(id)) {
      byId.set(id, el);
    }
  }
  return [...byId.values()];
}

export default function GisExportDialog({
  open,
  onOpenChange,
  mapId,
  mapName = '',
  elements = [],
  hiddenIds,
  pendingCount = 0,
  preparedMapIncomplete = false,
  exportGeoJson = exportGeoJsonToFile,
  exportShp = exportShapefile,
  fetchElements = fetchAllMapElements,
}) {
  const [step, setStep] = useState(STEPS.options);
  const [scope, setScope] = useState('whole');
  const [format, setFormat] = useState('geojson');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loadedElements, setLoadedElements] = useState(elements);
  const [loadingElements, setLoadingElements] = useState(false);
  const [incompleteWarning, setIncompleteWarning] = useState(preparedMapIncomplete);
  const online = isOnline();

  useEffect(() => {
    if (!open) return;
    setStep(STEPS.options);
    setScope('whole');
    setFormat('geojson');
    setSelectedIds(new Set(elements.map((element) => String(element.id))));
    setLoadedElements(elements);
    setIncompleteWarning(preparedMapIncomplete);
    let cancelled = false;
    setLoadingElements(true);
    if (!isOnline()) {
      setLoadingElements(false);
      return;
    }
    fetchElements(mapId)
      .then((all) => {
        if (cancelled) return;
        const merged = overlayPendingElements(all, elements);
        setLoadedElements(merged);
        setSelectedIds(new Set(merged.map((element) => String(element.id))));
      })
      .catch(() => {
        if (!cancelled) setLoadedElements(elements);
      })
      .finally(() => {
        if (!cancelled) setLoadingElements(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens
  }, [open, mapId]);

  useEffect(() => {
    if (!online && format === 'shapefile') {
      setFormat('geojson');
    }
  }, [online, format]);

  const collection = useMemo(() => {
    const ids = scope === 'selection' ? Array.from(selectedIds) : null;
    return buildFeatureCollection(loadedElements, {
      elementIds: ids,
      preparedMapIncomplete: incompleteWarning,
    });
  }, [loadedElements, scope, selectedIds, incompleteWarning]);

  const layers = useMemo(
    () => groupShapefileLayers(collection.features),
    [collection.features],
  );
  const truncationCount = useMemo(
    () => collectShapefileTruncationWarnings(collection.features),
    [collection.features],
  );

  const hasElements = loadedElements.length > 0;
  const selectionReady = scope !== 'selection' || selectedIds.size > 0;
  const canContinueOptions = hasElements && selectionReady && (format === 'geojson' || online);
  const canContinuePicker = selectedIds.size > 0;

  const goNext = () => {
    if (step === STEPS.options) {
      if (scope === 'selection') {
        setStep(STEPS.picker);
        return;
      }
      setStep(STEPS.confirm);
      return;
    }
    if (step === STEPS.picker) {
      setStep(STEPS.confirm);
    }
  };

  const goBack = () => {
    if (step === STEPS.confirm) {
      setStep(scope === 'selection' ? STEPS.picker : STEPS.options);
      return;
    }
    if (step === STEPS.picker) setStep(STEPS.options);
  };

  const handleDownload = async () => {
    if (collection.features.length === 0) {
      toast.error('Nenhum elemento válido para exportar.');
      return;
    }

    const fileName = buildGisExportFileName(mapName, format === 'geojson' ? 'geojson' : 'zip');
    setStep(STEPS.downloading);
    try {
      if (format === 'geojson') {
        await exportGeoJson(collection, fileName);
        toast.success('GeoJSON baixado com sucesso.');
      } else {
        await exportShp({
          mapId,
          scope,
          elementIds: scope === 'selection' ? Array.from(selectedIds) : [],
          fileName,
        });
        toast.success('Shapefile baixado com sucesso.');
      }
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof GisExportError || error instanceof ApiError
        ? error.message
        : 'Não foi possível exportar os dados.';
      toast.error(message);
      setStep(STEPS.confirm);
    }
  };

  const toggleId = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked) => {
    setSelectedIds(
      checked ? new Set(loadedElements.map((element) => String(element.id))) : new Set(),
    );
  };

  const primaryDisabled = step === STEPS.options
    ? !canContinueOptions
    : step === STEPS.picker
      ? !canContinuePicker
      : step === STEPS.downloading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary" />
            Exportar dados GIS
          </DialogTitle>
          <DialogDescription>
            Baixe os elementos do mapa em GeoJSON ou Shapefile (ZIP), como no gerador clássico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1 min-h-[12rem]">
          {!online ? (
            <p className="text-xs rounded-md border bg-muted/60 px-3 py-2" data-testid="gis-export-offline-note">
              Você está offline. GeoJSON usa os dados locais; Shapefile exige conexão.
            </p>
          ) : null}
          {pendingCount > 0 ? (
            <p className="text-xs rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              Há {pendingCount} alteração(ões) ainda não sincronizada(s). Elas entram no GeoJSON local.
            </p>
          ) : null}
          {incompleteWarning ? (
            <p className="text-xs rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900" data-testid="gis-export-incomplete-warning">
              O cache offline deste mapa pode estar incompleto. O arquivo exportado pode não ter todos os elementos.
            </p>
          ) : null}

          {step === STEPS.options ? (
            <div className="space-y-5" data-testid="gis-export-scope">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Escopo</legend>
                <RadioGroup value={scope} onValueChange={setScope} className="gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="whole" id="gis-export-scope-whole" />
                    Mapa inteiro
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="selection" id="gis-export-scope-selection" />
                    Seleção de elementos
                  </label>
                </RadioGroup>
              </fieldset>

              <fieldset className="space-y-2" data-testid="gis-export-format">
                <legend className="text-sm font-medium">Formato</legend>
                <RadioGroup value={format} onValueChange={setFormat} className="gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="geojson" id="gis-export-format-geojson" />
                    GeoJSON
                  </label>
                  <div className="space-y-1">
                    <label className={`flex items-center gap-2 text-sm ${online ? '' : 'opacity-60'}`}>
                      <RadioGroupItem
                        value="shapefile"
                        id="gis-export-format-shapefile"
                        disabled={!online}
                      />
                      Shapefile (ZIP)
                    </label>
                    {!online ? (
                      <p
                        className="text-xs text-muted-foreground pl-6"
                        data-testid="shapefile-requires-connection"
                        title="shapefile-requires-connection"
                      >
                        Shapefile requer conexão com o servidor.
                      </p>
                    ) : null}
                  </div>
                </RadioGroup>
              </fieldset>

              {!hasElements && !loadingElements ? (
                <p className="text-sm text-muted-foreground" data-testid="no-elements-message" role="alert">
                  Este mapa ainda não possui elementos para exportar.
                </p>
              ) : null}
              {loadingElements ? (
                <p className="text-xs text-muted-foreground">Carregando elementos…</p>
              ) : null}
            </div>
          ) : null}

          {step === STEPS.picker ? (
            <GisExportElementPicker
              elements={loadedElements}
              selectedIds={selectedIds}
              onToggle={toggleId}
              onToggleAll={toggleAll}
              hiddenIds={hiddenIds}
            />
          ) : null}

          {step === STEPS.confirm || step === STEPS.downloading ? (
            <div className="space-y-3 text-sm" data-testid="gis-export-summary">
              <p>
                <strong>{collection.features.length}</strong> elemento(s) ·{' '}
                {format === 'geojson' ? 'GeoJSON' : 'Shapefile'} ·{' '}
                {scope === 'whole' ? 'mapa inteiro' : 'seleção'}
              </p>
              {format === 'shapefile' ? (
                <ul className="rounded-md border divide-y" data-testid="gis-export-layers">
                  {layers.map((layer) => (
                    <li key={layer.id} className="px-3 py-2 flex justify-between">
                      <span>{layer.label}</span>
                      <span className="text-muted-foreground">{layer.count}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {format === 'shapefile' && truncationCount > 0 ? (
                <p className="text-xs text-amber-800">
                  {truncationCount} atributo(s) serão cortados em 254 caracteres no DBF.
                </p>
              ) : null}
              {collection.warnings.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {collection.warnings.length} geometria(s) inválida(s) serão omitidas.
                </p>
              ) : null}
              {step === STEPS.downloading ? (
                <div className="flex items-center gap-2 text-muted-foreground" data-testid="gis-export-downloading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando arquivo…
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step !== STEPS.options && step !== STEPS.downloading ? (
            <Button type="button" variant="ghost" onClick={goBack}>
              Voltar
            </Button>
          ) : null}
          {step === STEPS.confirm ? (
            <Button
              type="button"
              onClick={handleDownload}
              disabled={primaryDisabled || collection.features.length === 0}
              data-testid="gis-export-confirm"
            >
              <Download className="h-4 w-4" />
              Baixar
            </Button>
          ) : step !== STEPS.downloading ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={primaryDisabled}
              data-testid="gis-export-confirm"
            >
              Continuar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
