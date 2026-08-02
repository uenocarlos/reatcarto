import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { filterMunicipalities, isLocationFeatureActive } from '@/lib/export/locationPreview';

export default function LocationOptionsPanel({
  settings,
  onSettingsChange,
  disabled = false,
  states = [],
  municipalities = [],
  onStateChange,
  onMunicipalityChange,
  catalogSource,
  usedFallback = false,
}) {
  const locatorCount = settings?.locatorCount ?? 0;
  const locationActive = isLocationFeatureActive(settings);
  const [muniSearch, setMuniSearch] = useState('');

  const filteredMunicipalities = useMemo(
    () => filterMunicipalities(muniSearch, municipalities),
    [muniSearch, municipalities]
  );

  const searchActive = muniSearch.trim().length > 0;
  const municipalityListCap = 200;
  const visibleMunicipalities = searchActive
    ? filteredMunicipalities
    : filteredMunicipalities.slice(0, municipalityListCap);
  const municipalityListTruncated = filteredMunicipalities.length > visibleMunicipalities.length;

  const styleDisabled = disabled || locatorCount === 0;

  return (
    <div className="space-y-2" data-testid="export-location-options">
      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">🇧🇷 Localização Brasil</p>

      <RadioGroup
        value={String(locatorCount)}
        onValueChange={(v) => onSettingsChange?.({ locatorCount: Number(v) })}
        className="grid grid-cols-3 gap-1"
        disabled={disabled}
        data-testid="export-locator-count"
      >
        {[
          { v: 0, l: 'Nenhum' },
          { v: 1, l: '1 mapa' },
          { v: 2, l: '2 mapas' },
        ].map(({ v, l }) => (
          <div key={v} className="flex items-center gap-1">
            <RadioGroupItem value={String(v)} id={`loc-count-${v}`} />
            <Label htmlFor={`loc-count-${v}`} className="text-[10px] cursor-pointer">
              {l}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {locatorCount > 0 && (
        <>
          <div>
            <Label className="text-[10px]">UF</Label>
            <Select
              value={settings?.stateCode ?? ''}
              onValueChange={(value) => onStateChange?.(value)}
              disabled={disabled}
            >
              <SelectTrigger className="h-7 text-xs" data-testid="export-state-select">
                <SelectValue placeholder="Selecione a UF..." />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.sigla ? `${state.sigla} — ${state.name}` : state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px]">Município</Label>
            <Input
              value={muniSearch}
              onChange={(e) => setMuniSearch(e.target.value)}
              placeholder="Buscar município..."
              className="h-7 text-xs mb-1"
              disabled={disabled || !settings?.stateCode}
              data-testid="export-municipality-search"
            />
            <Select
              value={settings?.municipalityCode ?? ''}
              onValueChange={(value) => onMunicipalityChange?.(value)}
              disabled={disabled || !settings?.stateCode}
            >
              <SelectTrigger className="h-7 text-xs" data-testid="export-municipality-select">
                <SelectValue placeholder="Selecione o município..." />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {visibleMunicipalities.map((municipality) => (
                  <SelectItem key={municipality.code} value={municipality.code}>
                    {municipality.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {municipalityListTruncated && (
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                data-testid="export-municipality-refine-hint"
              >
                Mostrando {visibleMunicipalities.length} de {filteredMunicipalities.length} municípios. Digite na
                busca para refinar.
              </p>
            )}
          </div>

          {(!settings?.stateCode || !settings?.municipalityCode) && (
            <p className="text-[10px] text-destructive" data-testid="export-location-incomplete">
              Selecione UF e município para habilitar exportação com mapas de localização.
            </p>
          )}

          {usedFallback && (
            <p className="text-[10px] text-amber-700" data-testid="export-boundary-fallback-warning">
              Usando malha local de referência (fallback).
            </p>
          )}

          {catalogSource === 'fallback' && !usedFallback && (
            <p className="text-[10px] text-muted-foreground" data-testid="export-boundary-catalog-fallback">
              Catálogo offline carregado.
            </p>
          )}
        </>
      )}

      <div className={`space-y-1.5 ${styleDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <p className="text-[10px] font-semibold text-muted-foreground">Estilo no mapa principal</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <Label className="text-[10px]">Cor UF</Label>
            <Input
              type="color"
              value={settings?.stateColor ?? '#1D4ED8'}
              onChange={(e) => onSettingsChange?.({ stateColor: e.target.value })}
              className="h-7 p-0.5"
              disabled={styleDisabled}
              data-testid="export-state-color"
            />
          </div>
          <div>
            <Label className="text-[10px]">Cor município</Label>
            <Input
              type="color"
              value={settings?.municipalityColor ?? '#DC2626'}
              onChange={(e) => onSettingsChange?.({ municipalityColor: e.target.value })}
              className="h-7 p-0.5"
              disabled={styleDisabled}
              data-testid="export-municipality-color"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-state-legend"
              checked={Boolean(settings?.showStateInLegend)}
              onCheckedChange={(checked) => onSettingsChange?.({ showStateInLegend: Boolean(checked) })}
              disabled={styleDisabled}
              data-testid="export-show-state-legend"
            />
            <Label htmlFor="show-state-legend" className="text-[10px] cursor-pointer">
              Estado na legenda
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-muni-legend"
              checked={Boolean(settings?.showMunicipalityInLegend)}
              onCheckedChange={(checked) => onSettingsChange?.({ showMunicipalityInLegend: Boolean(checked) })}
              disabled={styleDisabled}
              data-testid="export-show-municipality-legend"
            />
            <Label htmlFor="show-muni-legend" className="text-[10px] cursor-pointer">
              Município na legenda
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-muni-mesh"
              checked={Boolean(settings?.showMunicipalMesh)}
              onCheckedChange={(checked) => onSettingsChange?.({ showMunicipalMesh: Boolean(checked) })}
              disabled={styleDisabled || !locationActive}
              data-testid="export-show-municipal-mesh"
            />
            <Label htmlFor="show-muni-mesh" className="text-[10px] cursor-pointer">
              Malha municipal
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
