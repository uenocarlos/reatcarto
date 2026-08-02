import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileImage } from 'lucide-react';
import { EXPORT_FORMATS } from '@/lib/export/exportGates';
import { validateExportGates, effectiveVisibleElements } from '@/lib/export/exportSettings';
import { isOfflineBasemapAvailable } from '@/lib/export/basemapResolver';
import { reclampLegendRectForOrientation } from '@/lib/export/paperFrame';
import { buildPreviewModel } from '@/lib/export/previewModel';
import CompositionPreview from './export/CompositionPreview';
import ExportVisibilityPanel from './export/ExportVisibilityPanel';
import LocationOptionsPanel from './export/LocationOptionsPanel';
import { useExportLocationBoundaries } from '@/lib/export/useExportLocationBoundaries';

export default function ExportMapModal({
  open,
  onClose,
  onExport,
  elements,
  settings,
  onSettingsChange,
  ownershipLost = false,
  isExporting = false,
  mapId,
}) {
  const previewRef = React.useRef(null);
  const [frozenExport, setFrozenExport] = useState(null);
  const config = settings ?? {};
  const basemap = config.basemap ?? 'carto';
  const [basemapReadiness, setBasemapReadiness] = useState({});
  const optionsDisabled = ownershipLost || isExporting;

  useEffect(() => {
    setBasemapReadiness({});
  }, [basemap]);

  useEffect(() => {
    if (isExporting) {
      setFrozenExport((prev) => prev ?? { settings: config, elements });
    } else {
      setFrozenExport(null);
    }
  }, [isExporting, config, elements]);

  const previewSettings = isExporting && frozenExport ? frozenExport.settings : config;
  const previewElements = isExporting && frozenExport ? frozenExport.elements : elements;

  const isNative = Capacitor.isNativePlatform();
  const offlineAvailable = isOfflineBasemapAvailable(isNative);

  const update = useCallback(
    (key, value) => {
      if (isExporting) return;
      onSettingsChange?.({ [key]: value });
    },
    [onSettingsChange, isExporting]
  );

  const handleBasemapReadinessChange = useCallback((next) => {
    setBasemapReadiness(next);
  }, []);

  const locationBoundaries = useExportLocationBoundaries({
    settings: config,
    onSettingsChange,
    enabled: open && !ownershipLost && !isExporting,
  });

  const previewModel = useMemo(
    () =>
      buildPreviewModel({
        settings: previewSettings,
        elements: previewElements,
        isNativePlatform: isNative,
        basemapReadiness,
        boundaryLoading: locationBoundaries.boundaryLoading,
        boundaryResult: locationBoundaries.boundaryResult,
        boundaryError: Boolean(locationBoundaries.boundaryError),
        locationLabels: locationBoundaries.locationLabels,
      }),
    [previewSettings, previewElements, isNative, basemapReadiness, locationBoundaries]
  );

  const gateResult = useMemo(() => {
    const visible = effectiveVisibleElements(previewElements, previewSettings);
    return validateExportGates(previewSettings, visible, previewModel.legendItems);
  }, [previewSettings, previewElements, previewModel.legendItems]);

  const exportDisabled =
    ownershipLost ||
    !gateResult.ok ||
    Boolean(locationBoundaries.boundaryError) ||
    isExporting ||
    previewModel.previewStatus !== 'ready';
  const formatOptions = EXPORT_FORMATS;

  const handleExportClick = () => {
    if (exportDisabled || isExporting) return;
    setFrozenExport({ settings: config, elements });
    onExport({ ...config, format: 'png' }, previewRef.current);
  };

  const handleLegendRectChange = (rect) => {
    if (isExporting) return;
    onSettingsChange?.({ legendRect: rect });
  };

  const basemapOptions = [
    ['carto', 'Claro'],
    ['osm', 'Padrão'],
    ['satellite', 'Satélite'],
    ['offline', 'Offline (Pasta Tiles)'],
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-full max-w-5xl max-h-[95dvh] p-0 flex flex-col gap-0 overflow-hidden"
        data-testid="export-map-modal"
        data-map-id={mapId}
        data-mobile-layout="stack"
      >
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">🗺️ Configurar Exportação do Mapa</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
          <ScrollArea
            className="w-full md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r max-h-[40dvh] md:max-h-none md:h-[60dvh]"
            data-testid="export-options-scroll"
            data-options-disabled={optionsDisabled ? 'true' : 'false'}
          >
            <div className="p-3 space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">📝 Textos do Mapa</p>
                <div>
                  <Label className="text-xs">Título do Mapa:</Label>
                  <Input
                    value={config.title ?? ''}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder="Título..."
                    className="h-7 text-xs mt-0.5"
                    disabled={optionsDisabled}
                  />
                </div>
                <div>
                  <Label className="text-xs">Autoria:</Label>
                  <Input
                    value={config.author ?? ''}
                    onChange={(e) => update('author', e.target.value)}
                    placeholder="Autor..."
                    className="h-7 text-xs mt-0.5"
                    disabled={optionsDisabled}
                  />
                </div>
                <div>
                  <Label className="text-xs">Responsável Técnico:</Label>
                  <Input
                    value={config.technicalResponsible ?? ''}
                    onChange={(e) => update('technicalResponsible', e.target.value)}
                    placeholder="Responsável..."
                    className="h-7 text-xs mt-0.5"
                    disabled={optionsDisabled}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">📥 Formato</p>
                <RadioGroup value="png" className="space-y-1">
                  {formatOptions.map((fmt) => (
                    <div key={fmt} className="flex items-center gap-1.5">
                      <RadioGroupItem value={fmt} id={`fmt-${fmt}`} disabled />
                      <Label htmlFor={`fmt-${fmt}`} className="text-xs cursor-pointer flex items-center gap-1">
                        <FileImage className="w-3 h-3" /> {fmt.toUpperCase()}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">📋 Papel</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px]">Tamanho</Label>
                    <Select value={config.paperSize ?? 'A4'} onValueChange={(v) => update('paperSize', v)} disabled={optionsDisabled}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4</SelectItem>
                        <SelectItem value="A3">A3</SelectItem>
                        <SelectItem value="Letter">Letter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Orientação</Label>
                    <Select
                      value={config.orientation ?? 'landscape'}
                      onValueChange={(v) => {
                        if (isExporting) return;
                        const patch = { orientation: v };
                        if ((config.legendPosition ?? 'inside') === 'inside' && config.legendRect) {
                          patch.legendRect = reclampLegendRectForOrientation(config.legendRect, v);
                        }
                        onSettingsChange?.(patch);
                      }}
                      disabled={optionsDisabled}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landscape">Paisagem</SelectItem>
                        <SelectItem value="portrait">Retrato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">🎯 Qualidade</p>
                <div>
                  <Label className="text-xs">DPI:</Label>
                  <Input
                    type="number"
                    value={config.dpi ?? 300}
                    onChange={(e) => update('dpi', parseInt(e.target.value, 10))}
                    min={72}
                    max={600}
                    step={72}
                    className="h-7 text-xs mt-0.5"
                    disabled={optionsDisabled}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">📍 Posição da Legenda</p>
                <RadioGroup
                  value={config.legendPosition ?? 'inside'}
                  onValueChange={(v) => update('legendPosition', v)}
                  className="space-y-1"
                  disabled={optionsDisabled}
                >
                  {[
                    { v: 'inside', l: 'Dentro do Mapa' },
                    { v: 'beside', l: 'Ao Lado' },
                    { v: 'below', l: 'Abaixo do Mapa' },
                  ].map(({ v, l }) => (
                    <div key={v} className="flex items-center gap-1.5">
                      <RadioGroupItem value={v} id={`leg-${v}`} />
                      <Label htmlFor={`leg-${v}`} className="text-xs cursor-pointer">
                        {l}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label className="text-[10px]">Colunas</Label>
                  <Select
                    value={String(config.legendColumns ?? 2)}
                    onValueChange={(v) => update('legendColumns', parseInt(v, 10))}
                    disabled={optionsDisabled}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Fonte (px)</Label>
                  <Select
                    value={String(config.legendFontSizePx ?? 12)}
                    onValueChange={(v) => update('legendFontSizePx', parseInt(v, 10))}
                    disabled={optionsDisabled}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[8, 10, 12, 14, 16, 18].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-[10px]">Espaçamento</Label>
                <Select
                  value={config.legendSpacing ?? 'normal'}
                  onValueChange={(v) => update('legendSpacing', v)}
                  disabled={optionsDisabled}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compacto</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="wide">Amplo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ExportVisibilityPanel
                elements={elements}
                settings={config}
                onSettingsChange={onSettingsChange}
                disabled={optionsDisabled}
              />

              <LocationOptionsPanel
                settings={config}
                onSettingsChange={onSettingsChange}
                disabled={optionsDisabled}
                states={locationBoundaries.states}
                municipalities={locationBoundaries.municipalities}
                onStateChange={locationBoundaries.handleStateChange}
                onMunicipalityChange={locationBoundaries.handleMunicipalityChange}
                catalogSource={locationBoundaries.catalogSource}
                usedFallback={previewModel.boundaryUsedFallback}
              />

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">🗺️ Camada Base</p>
                <RadioGroup
                  value={basemap}
                  onValueChange={(v) => update('basemap', v)}
                  className="grid grid-cols-2 gap-2"
                  disabled={optionsDisabled}
                >
                  {basemapOptions.map(([v, l]) => {
                    const isOffline = v === 'offline';
                    const disabledOption = isOffline && !offlineAvailable;
                    return (
                      <div key={v} className="flex items-center space-x-2">
                        <RadioGroupItem value={v} id={`base-${v}`} disabled={disabledOption || optionsDisabled} />
                        <Label
                          htmlFor={`base-${v}`}
                          className={`text-xs cursor-pointer ${disabledOption ? 'opacity-50' : ''}`}
                          data-testid={isOffline ? 'export-basemap-offline' : undefined}
                          data-offline-disabled={disabledOption ? 'true' : undefined}
                        >
                          {l}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
                {!offlineAvailable && (
                  <p className="text-[10px] text-muted-foreground" data-testid="export-offline-web-disabled">
                    Offline disponível apenas no app nativo.
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="flex-1 flex flex-col min-w-0 bg-gray-100 h-[50dvh] md:h-[60dvh]" data-testid="export-preview-column">
            <div
              className={`flex-1 p-3 min-h-0 flex flex-col gap-1 overflow-auto${isExporting ? ' pointer-events-none' : ''}`}
              data-preview-frozen={isExporting ? 'true' : 'false'}
            >
              <CompositionPreview
                settings={previewSettings}
                elements={previewElements}
                previewRef={previewRef}
                onLegendRectChange={handleLegendRectChange}
                basemapReadiness={basemapReadiness}
                onBasemapReadinessChange={handleBasemapReadinessChange}
                boundaryLoading={locationBoundaries.boundaryLoading}
                boundaryResult={locationBoundaries.boundaryResult}
                boundaryError={Boolean(locationBoundaries.boundaryError)}
                locationLabels={locationBoundaries.locationLabels}
              />
              {previewModel.previewStatus === 'loading' && (
                <p className="text-xs text-muted-foreground" data-testid="export-preview-loading">
                  Carregando preview…
                </p>
              )}
              {previewModel.previewStatus === 'error' && (
                <p className="text-xs text-destructive" data-testid="export-preview-error">
                  {locationBoundaries.boundaryError
                    ? 'Limites administrativos indisponíveis para exportação.'
                    : 'Basemap indisponível para exportação.'}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-4 py-2.5 border-t flex-shrink-0 gap-2 bg-gray-50">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500 hover:bg-gray-200" data-testid="export-cancel">
            Cancelar
          </Button>
          <div className="flex-1">
            {ownershipLost && (
              <p className="text-xs text-destructive" data-testid="export-ownership-lost">
                Sessão ou propriedade do mapa perdida. Exportação desabilitada.
              </p>
            )}
            {!ownershipLost && !gateResult.ok && (
              <p className="text-xs text-destructive" data-testid="export-gate-errors">
                {[
                  ...gateResult.errors.map((e) => e.field),
                  locationBoundaries.boundaryError ? 'boundary' : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleExportClick}
            disabled={exportDisabled}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            data-testid="export-map-submit"
            data-exporting={isExporting ? 'true' : 'false'}
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Gerando…' : 'Exportar Mapa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
