import React, { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ELEMENT_TYPE_LABELS } from '@/lib/gis/constants';

function geometryLabel(element) {
  return ELEMENT_TYPE_LABELS[element?.element_type] || element?.element_type || 'Elemento';
}

export default function GisExportElementPicker({
  elements = [],
  selectedIds,
  onToggle,
  onToggleAll,
  hiddenIds,
}) {
  const hidden = useMemo(
    () => new Set(Array.from(hiddenIds ?? []).map((id) => String(id))),
    [hiddenIds],
  );
  const allIds = elements.map((element) => String(element.id));
  const selectedCount = allIds.filter((id) => selectedIds.has(id)).length;
  const allChecked = allIds.length > 0 && selectedCount === allIds.length;

  return (
    <div className="space-y-3" data-testid="gis-export-picker">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={allChecked}
          onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
          data-testid="gis-export-select-all"
          aria-label="Selecionar todos"
        />
        Selecionar todos ({selectedCount}/{allIds.length})
      </label>

      {elements.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum elemento neste mapa.
        </div>
      ) : (
        <div className="rounded-lg border max-h-56 overflow-y-auto divide-y">
          {elements.map((element) => {
            const id = String(element.id);
            const checked = selectedIds.has(id);
            const isHidden = hidden.has(id);
            return (
              <label
                key={id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/60"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(id)}
                  data-testid={`gis-export-element-${id}`}
                />
                <span className="text-xs font-semibold uppercase text-muted-foreground w-16 shrink-0">
                  {geometryLabel(element)}
                </span>
                <span className="text-sm truncate flex-1">
                  {element.name?.trim() || 'Sem nome'}
                </span>
                {isHidden ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Oculto
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
