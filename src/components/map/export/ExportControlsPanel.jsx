import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { BASEMAP_OPTIONS } from '@/components/map/ElementLayersPanel';
import {
  LEGEND_COLUMNS_MAX,
  LEGEND_COLUMNS_MIN,
  LEGEND_FONT_MAX,
  LEGEND_FONT_MIN,
  LEGEND_SPACING_VALUES,
  MAX_DPI,
  MIN_DPI,
  setFormat,
  setDpi,
  setLegendColumns,
  setLocationCount,
  validateLegendFontPx,
  validateLegendSpacing,
  loadGeoBoundaries,
  filterMunicipalitiesByUf,
} from '@/lib/export';
import {
  buildCategoryGroups,
} from '@/lib/export/layerGrouping';

const SPACING_LABELS = {
  very_compact: 'Muito compacto',
  compact: 'Compacto',
  normal: 'Normal',
  loose: 'Solto',
  very_loose: 'Muito solto',
};

const COLUMN_OPTIONS = Array.from(
  { length: LEGEND_COLUMNS_MAX - LEGEND_COLUMNS_MIN + 1 },
  (_, i) => LEGEND_COLUMNS_MIN + i,
);

const FONT_OPTIONS = Array.from(
  { length: LEGEND_FONT_MAX - LEGEND_FONT_MIN + 1 },
  (_, i) => LEGEND_FONT_MIN + i,
);

export const DENSE_LEGEND_THRESHOLD = 80;

function ControlGroup({ title, testId, children }) {
  return (
    <section className="export-control-group" data-testid={testId}>
      <h3 className="export-control-group__title">{title}</h3>
      {children}
    </section>
  );
}

function ColorSwatch({ color, title }) {
  if (!color) return null;
  return (
    <span
      className="inline-block w-3 h-3 rounded-[2px] border border-black/15 shrink-0"
      style={{ backgroundColor: color }}
      title={title || color}
      aria-hidden
    />
  );
}

export default function ExportControlsPanel({
  session,
  onSessionChange,
  titleError = null,
}) {
  const [geoOptions, setGeoOptions] = useState({ states: [], municipalities: [] });
  const patch = (partial) => onSessionChange((prev) => ({ ...prev, ...partial }));
  const grouped = useMemo(
    () => buildCategoryGroups(session.elements, session.elementCategories),
    [session.elements, session.elementCategories],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await loadGeoBoundaries();
        if (cancelled) return;
        setGeoOptions({
          states: [...result.states].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
          municipalities: result.municipalities,
        });
      } catch {
        if (!cancelled) {
          setGeoOptions({ states: [], municipalities: [] });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const showDenseHint = session.format === 'pdf'
    || session.elements.filter((el) => !session.hiddenIds.has(String(el.id))).length >= DENSE_LEGEND_THRESHOLD;

  const isHidden = (id) => session.hiddenIds.has(String(id));

  const setGroupHidden = (ids, hide) => {
    onSessionChange((prev) => {
      const next = new Set(prev.hiddenIds);
      for (const id of ids) {
        if (hide) next.add(String(id));
        else next.delete(String(id));
      }
      return { ...prev, hiddenIds: next };
    });
  };

  const groupVisibility = (ids) => {
    const hiddenCount = ids.filter((id) => isHidden(id)).length;
    if (hiddenCount === 0) return true;
    if (hiddenCount === ids.length) return false;
    return 'indeterminate';
  };

  const categoryAllHidden = (category) => {
    const list = grouped.raw[category];
    if (!list.length) return false;
    return list.every((el) => isHidden(el.id));
  };

  const categorySomeVisible = (category) => grouped.raw[category].some((el) => !isHidden(el.id));

  const toggleCategory = (category) => {
    const list = grouped.raw[category];
    if (!list.length) return;
    const hideAll = !categoryAllHidden(category);
    onSessionChange((prev) => {
      const next = new Set(prev.hiddenIds);
      for (const el of list) {
        const key = String(el.id);
        if (hideAll) next.add(key);
        else next.delete(key);
      }
      return { ...prev, hiddenIds: next };
    });
  };

  const showAll = () => onSessionChange((prev) => ({ ...prev, hiddenIds: new Set() }));
  const hideAll = () => {
    onSessionChange((prev) => {
      const next = new Set();
      for (const el of prev.elements) next.add(String(el.id));
      return { ...prev, hiddenIds: next };
    });
  };

  const updateLocation = (field, value) => {
    onSessionChange((prev) => {
      const nextValue = value || null;
      const current = prev.locations[0] ?? {
        uf: null,
        stateName: null,
        municipioCode: null,
        municipioName: null,
      };
      let nextPrimary = {
        ...current,
        [field]: nextValue,
      };

      if (field === 'uf') {
        const state = geoOptions.states.find((entry) => entry.uf === nextValue) ?? null;
        nextPrimary = {
          ...nextPrimary,
          uf: nextValue,
          stateName: state?.name ?? nextValue ?? null,
          municipioCode: null,
          municipioName: null,
        };
      }

      if (field === 'municipioCode') {
        const municipio = availableMunicipios.find((entry) => entry.code === nextValue) ?? null;
        nextPrimary = {
          ...nextPrimary,
          municipioCode: nextValue,
          municipioName: municipio?.name ?? null,
        };
      }
      const locations = [
        nextPrimary,
        prev.locationCount === 2
          ? { ...nextPrimary }
          : (prev.locations[1] ?? { uf: null, stateName: null, municipioCode: null, municipioName: null }),
      ];
      return { ...prev, locations };
    });
  };

  const primaryLocation = session.locations[0] ?? {
    uf: null,
    stateName: null,
    municipioCode: null,
    municipioName: null,
  };
  const availableMunicipios = useMemo(
    () => filterMunicipalitiesByUf(geoOptions.municipalities, primaryLocation.uf)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [geoOptions.municipalities, primaryLocation.uf],
  );

  return (
    <ScrollArea className="export-shell__controls-scroll" data-testid="export-controls-scroll">
      <div className="export-shell__controls-inner">
        <ControlGroup title="Textos" testId="export-control-group-textos">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-title-input">Titulo do mapa</Label>
              <Input
                id="export-title-input"
                data-testid="export-title-input"
                value={session.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Titulo obrigatorio para exportar"
              />
              {titleError ? (
                <p className="text-xs text-destructive" data-testid="export-title-error" role="alert">
                  {titleError}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-authorship">Autoria</Label>
              <Input
                id="export-authorship"
                data-testid="export-authorship-input"
                value={session.authorship}
                onChange={(e) => patch({ authorship: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-technical">Responsavel tecnico</Label>
              <Input
                id="export-technical"
                data-testid="export-technical-input"
                value={session.technicalResponsible}
                onChange={(e) => patch({ technicalResponsible: e.target.value })}
              />
            </div>
          </div>
        </ControlGroup>

        <ControlGroup title="Formato" testId="export-control-group-formato">
          <RadioGroup
            value={session.format}
            onValueChange={(value) => onSessionChange((prev) => setFormat(prev, value))}
            className="flex gap-4"
            data-testid="export-format-radio"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="png" id="export-format-png" />
              <Label htmlFor="export-format-png">PNG</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pdf" id="export-format-pdf" />
              <Label htmlFor="export-format-pdf">PDF</Label>
            </div>
          </RadioGroup>
          {showDenseHint ? (
            <p className="export-shell__dense-hint" data-testid="export-dense-legend-hint">
              Legendas extensas ou exportacao em PDF podem ficar pesadas. Prefira PNG para mapas com muitos itens.
            </p>
          ) : null}
        </ControlGroup>

        <ControlGroup title="Papel" testId="export-control-group-papel">
          <div className="space-y-3">
            <RadioGroup
              value={session.paper}
              onValueChange={(value) => patch({ paper: value })}
              className="flex flex-wrap gap-3"
              data-testid="export-paper-radio"
            >
              {['a4', 'a3', 'letter'].map((paper) => (
                <div key={paper} className="flex items-center gap-2">
                  <RadioGroupItem value={paper} id={`export-paper-${paper}`} />
                  <Label htmlFor={`export-paper-${paper}`}>{paper.toUpperCase()}</Label>
                </div>
              ))}
            </RadioGroup>
            <RadioGroup
              value={session.orientation}
              onValueChange={(value) => patch({ orientation: value })}
              className="flex gap-4"
              data-testid="export-orientation-radio"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="landscape" id="export-orientation-landscape" />
                <Label htmlFor="export-orientation-landscape">Paisagem</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="portrait" id="export-orientation-portrait" />
                <Label htmlFor="export-orientation-portrait">Retrato</Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label htmlFor="export-dpi-input">DPI ({session.dpi})</Label>
              <Slider
                id="export-dpi-slider"
                data-testid="export-dpi-slider"
                min={MIN_DPI}
                max={MAX_DPI}
                step={1}
                value={[session.dpi]}
                onValueChange={([value]) => onSessionChange((prev) => setDpi(prev, value))}
              />
              <Input
                id="export-dpi-input"
                data-testid="export-dpi-input"
                type="number"
                min={MIN_DPI}
                max={MAX_DPI}
                value={session.dpi}
                onChange={(e) => onSessionChange((prev) => setDpi(prev, e.target.value))}
              />
            </div>
          </div>
        </ControlGroup>

        <ControlGroup title="Legenda" testId="export-control-group-legenda">
          <div className="space-y-3">
            <RadioGroup
              value={session.legendPosition}
              onValueChange={(value) => patch({ legendPosition: value })}
              className="space-y-1.5"
              data-testid="export-legend-position-radio"
            >
              {[
                { value: 'inside', label: 'Dentro do mapa' },
                { value: 'right', label: 'À direita' },
                { value: 'bottom', label: 'Abaixo' },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`export-legend-${opt.value}`} />
                  <Label htmlFor={`export-legend-${opt.value}`}>{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="export-legend-columns">Colunas</Label>
                <Select
                  value={String(session.legendColumns)}
                  onValueChange={(value) => onSessionChange((prev) => setLegendColumns(prev, value))}
                >
                  <SelectTrigger id="export-legend-columns" data-testid="export-legend-columns-input">
                    <SelectValue placeholder="Colunas" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMN_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="export-legend-font">Fonte (px)</Label>
                <Select
                  value={String(session.legendFontPx)}
                  onValueChange={(value) => {
                    const result = validateLegendFontPx(value);
                    patch({ legendFontPx: result.value });
                  }}
                >
                  <SelectTrigger id="export-legend-font" data-testid="export-legend-font-input">
                    <SelectValue placeholder="Fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}px</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Select
              value={session.legendSpacing}
              onValueChange={(value) => patch({ legendSpacing: validateLegendSpacing(value) })}
            >
              <SelectTrigger data-testid="export-legend-spacing-select">
                <SelectValue placeholder="Espacamento" />
              </SelectTrigger>
              <SelectContent>
                {LEGEND_SPACING_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {SPACING_LABELS[value] || value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(session.legendGroupByTopic)}
                onCheckedChange={(checked) => patch({ legendGroupByTopic: checked === true })}
                data-testid="export-legend-group-topics"
              />
              Agrupar por Terra, Agua e Conflito
            </label>
          </div>
        </ControlGroup>

        <ControlGroup title="Camadas" testId="export-control-group-camadas">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={session.showLabels}
                onCheckedChange={(checked) => patch({ showLabels: checked === true })}
                data-testid="export-show-labels"
              />
              Exibir rotulos dos elementos
            </label>
            <div className="export-layers-panel export-layers-scroll" data-testid="export-layers-scroll">
              <div className="export-layers-panel__actions">
                <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" type="button" onClick={showAll}>
                  <Eye className="w-3 h-3 mr-1" />
                  Todos
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" type="button" onClick={hideAll}>
                  <EyeOff className="w-3 h-3 mr-1" />
                  Nenhum
                </Button>
              </div>
              <div className="export-layers-panel__list">
                {session.elements.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 px-2">
                    Nenhum elemento neste mapa.
                  </p>
                ) : (
                  grouped.categoryOrder.map((category) => {
                    const list = grouped.groups[category];
                    if (!list.length) return null;
                    const allHidden = categoryAllHidden(category);
                    return (
                      <div key={category} className="export-layers-panel__type" data-testid={`export-layer-type-${category}`}>
                        <button
                          type="button"
                          className="export-layers-panel__type-btn"
                          onClick={() => toggleCategory(category)}
                        >
                          <Layers className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-xs font-semibold flex-1 text-left">
                            {grouped.categoryLabel(category)}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {grouped.counts[category]}
                          </span>
                          {allHidden ? (
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <Eye className={`w-3.5 h-3.5 ${categorySomeVisible(category) ? 'text-primary' : 'text-muted-foreground'}`} />
                          )}
                        </button>
                        <ul className="export-layers-panel__items">
                          {list.map((group) => {
                            const checked = groupVisibility(group.ids);
                            const titleParts = [group.label];
                            if (group.hints?.length) titleParts.push(group.hints.join(' · '));
                            return (
                              <li key={group.key}>
                                <label className="export-layers-panel__item">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => setGroupHidden(group.ids, value !== true)}
                                  />
                                  {group.hasNameCollision && group.swatches?.length
                                    ? group.swatches.map((swatch, index) => (
                                        <ColorSwatch
                                          key={`${swatch.color}-${index}`}
                                          color={swatch.color}
                                          title={swatch.title}
                                        />
                                      ))
                                    : null}
                                  <span
                                    className="truncate flex-1 text-muted-foreground min-w-0"
                                    title={titleParts.join(' · ')}
                                  >
                                    {group.label}
                                    {group.hasNameCollision && group.hints?.length ? (
                                      <span className="text-[10px] text-muted-foreground/80">
                                        {' · '}
                                        {group.hints.join(' · ')}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                                {group.ids.map((id) => (
                                  <button
                                    key={id}
                                    type="button"
                                    data-testid={`export-layer-${id}`}
                                    className="sr-only"
                                    tabIndex={-1}
                                    role="checkbox"
                                    aria-checked={!isHidden(id)}
                                    aria-label={`Exibir ${group.label}`}
                                    onClick={() => {
                                      const allVisible = groupVisibility(group.ids) === true;
                                      setGroupHidden(group.ids, allVisible);
                                    }}
                                  >
                                    toggle {id}
                                  </button>
                                ))}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ControlGroup>

        <ControlGroup title="Mapa base" testId="export-control-group-basemap">
          <RadioGroup
            value={session.basemap}
            onValueChange={(value) => patch({ basemap: value })}
            className="gap-1.5"
            data-testid="export-basemap-radio"
          >
            {BASEMAP_OPTIONS.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <RadioGroupItem value={opt.id} id={`export-basemap-${opt.id}`} />
                <Label htmlFor={`export-basemap-${opt.id}`} className="text-xs font-normal">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </ControlGroup>

        <ControlGroup title="Localizacao" testId="export-control-group-localizacao">
          <div className="space-y-3">
            <RadioGroup
              value={String(session.locationCount)}
              onValueChange={(value) => onSessionChange((prev) => setLocationCount(prev, Number(value)))}
              className="flex gap-3"
              data-testid="export-location-count-radio"
            >
              {[0, 1, 2].map((count) => (
                <div key={count} className="flex items-center gap-2">
                  <RadioGroupItem value={String(count)} id={`export-location-count-${count}`} />
                  <Label htmlFor={`export-location-count-${count}`}>{count}</Label>
                </div>
              ))}
            </RadioGroup>

            {session.locationCount > 0 ? (
              <div className="space-y-2 rounded-md border p-2">
                <p className="text-xs font-medium">
                  {session.locationCount === 2 ? 'Estado + municipio do estado' : 'Mapa de localizacao'}
                </p>
                <Select
                  value={primaryLocation.uf ?? ''}
                  onValueChange={(value) => updateLocation('uf', value)}
                >
                  <SelectTrigger data-testid="export-location-uf-0">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {geoOptions.states.map((state) => (
                      <SelectItem key={state.uf} value={state.uf}>{state.uf} - {state.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={primaryLocation.municipioCode ?? ''}
                  onValueChange={(value) => updateLocation('municipioCode', value)}
                  disabled={!primaryLocation.uf || availableMunicipios.length === 0}
                >
                  <SelectTrigger data-testid="export-location-municipio-0">
                    <SelectValue placeholder={primaryLocation.uf ? 'Municipio' : 'Selecione a UF antes'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMunicipios.map((municipio) => (
                      <SelectItem key={municipio.code} value={municipio.code}>
                        {municipio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {session.locationCount > 0 ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={session.showMunicipalMesh}
                    onCheckedChange={(checked) => patch({ showMunicipalMesh: checked === true })}
                    data-testid="export-municipal-mesh"
                  />
                  Malha do municipio
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={session.stateOnLegend}
                    onCheckedChange={(checked) => patch({ stateOnLegend: checked === true })}
                    data-testid="export-state-on-legend"
                  />
                  Malha do estado
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="export-state-color">Cor UF</Label>
                    <Input
                      id="export-state-color"
                      data-testid="export-state-color"
                      type="color"
                      value={session.stateColor}
                      onChange={(e) => patch({ stateColor: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="export-municipio-color">Cor municipio</Label>
                    <Input
                      id="export-municipio-color"
                      data-testid="export-municipio-color"
                      type="color"
                      value={session.municipioColor}
                      onChange={(e) => patch({ municipioColor: e.target.value })}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </ControlGroup>
      </div>
    </ScrollArea>
  );
}
