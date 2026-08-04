import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Layers, MapPin, Minus, Pentagon, Eye, EyeOff, X, Map as MapIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { buildTypeGroups, TYPE_ORDER } from '@/lib/export/layerGrouping';

const TYPE_META = {
  point: { label: 'Pontos', Icon: MapPin },
  line: { label: 'Linhas', Icon: Minus },
  polygon: { label: 'Poligonos', Icon: Pentagon },
};

export const BASEMAP_OPTIONS = [
  { id: 'branco', label: 'Mapa Branco' },
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'satelite', label: 'Satélite' },
];

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

export default function ElementLayersPanel({
  elements = [],
  hiddenIds,
  onHiddenIdsChange,
  open,
  onOpenChange,
  basemap = 'branco',
  onBasemapChange,
}) {
  const grouped = useMemo(() => buildTypeGroups(elements), [elements]);

  const isHidden = (id) => hiddenIds.has(String(id));

  const setGroupHidden = (ids, hide) => {
    const next = new Set(hiddenIds);
    for (const id of ids) {
      if (hide) next.add(String(id));
      else next.delete(String(id));
    }
    onHiddenIdsChange(next);
  };

  const groupVisibility = (ids) => {
    const hiddenCount = ids.filter((id) => isHidden(id)).length;
    if (hiddenCount === 0) return true;
    if (hiddenCount === ids.length) return false;
    return 'indeterminate';
  };

  const typeAllHidden = (type) => {
    const list = grouped.raw[type];
    if (!list.length) return false;
    return list.every((el) => isHidden(el.id));
  };

  const typeSomeVisible = (type) => grouped.raw[type].some((el) => !isHidden(el.id));

  const toggleType = (type) => {
    const list = grouped.raw[type];
    if (!list.length) return;
    const next = new Set(hiddenIds);
    const hideAll = !typeAllHidden(type);
    for (const el of list) {
      const key = String(el.id);
      if (hideAll) next.add(key);
      else next.delete(key);
    }
    onHiddenIdsChange(next);
  };

  const showAll = () => onHiddenIdsChange(new Set());
  const hideAll = () => {
    const next = new Set();
    for (const el of elements) next.add(String(el.id));
    onHiddenIdsChange(next);
  };

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="icon"
        className="h-12 w-12 shadow-lg bg-card border rounded-[12px]"
        onClick={() => onOpenChange(!open)}
        title="Camadas"
        aria-expanded={open}
      >
        <Layers className="w-6 h-6 text-primary" />
      </Button>

      {open ? (
        <div className="absolute top-0 right-14 w-64 max-h-[min(70vh,420px)] bg-card border rounded-xl shadow-xl overflow-hidden flex flex-col z-[1001]">
          <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0">
            <div>
              <p className="text-sm font-semibold leading-none">Camadas</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                Mapa base e elementos
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {onBasemapChange ? (
            <div className="px-3 py-2.5 border-b shrink-0 space-y-2">
              <div className="flex items-center gap-1.5">
                <MapIcon className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mapa base
                </span>
              </div>
              <RadioGroup value={basemap} onValueChange={onBasemapChange} className="gap-1.5">
                {BASEMAP_OPTIONS.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2 px-1 py-0.5">
                    <RadioGroupItem value={opt.id} id={`basemap-${opt.id}`} />
                    <Label
                      htmlFor={`basemap-${opt.id}`}
                      className="text-xs font-normal cursor-pointer text-muted-foreground"
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : null}

          <div className="px-3 py-2 flex gap-2 border-b shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" onClick={showAll}>
              <Eye className="w-3 h-3 mr-1" />
              Todos
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" onClick={hideAll}>
              <EyeOff className="w-3 h-3 mr-1" />
              Nenhum
            </Button>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-3">
            {TYPE_ORDER.map((type) => {
              const { label, Icon } = TYPE_META[type];
              const list = grouped[type];
              if (!list.length) return null;
              const allHidden = typeAllHidden(type);

              return (
                <div key={type} className="space-y-1">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/80 transition text-left"
                    onClick={() => toggleType(type)}
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold flex-1">{label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {grouped.counts[type]}
                    </span>
                    {allHidden ? (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className={`w-3.5 h-3.5 ${typeSomeVisible(type) ? 'text-primary' : 'text-muted-foreground'}`} />
                    )}
                  </button>
                  <ul className="pl-2 space-y-0.5 border-l border-border ml-3">
                    {list.map((group) => {
                      const checked = groupVisibility(group.ids);
                      const titleParts = [group.label];
                      if (group.hints?.length) titleParts.push(group.hints.join(' · '));
                      return (
                        <li key={group.key}>
                          <label className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/60 cursor-pointer text-xs">
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
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            {elements.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-2">
                Nenhum elemento neste mapa.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
