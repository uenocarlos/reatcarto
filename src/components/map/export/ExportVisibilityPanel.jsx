import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { groupElementsByCategory, isCategoryVisible, isElementVisible } from '@/lib/export/exportVisibility';

export default function ExportVisibilityPanel({ elements, settings, onSettingsChange, disabled = false }) {
  const groups = groupElementsByCategory(elements);

  const toggleCategory = (categoryId) => {
    const visible = isCategoryVisible(settings, categoryId, elements);
    const hidden = new Set(settings.hiddenCategoryIds ?? []);
    if (visible) hidden.add(categoryId);
    else hidden.delete(categoryId);
    onSettingsChange?.({ hiddenCategoryIds: [...hidden] });
  };

  const toggleElement = (elementId, categoryId) => {
    if (!isCategoryVisible(settings, categoryId, elements)) return;
    const visible = isElementVisible(settings, elementId, elements);
    const hidden = new Set(settings.hiddenElementIds ?? []);
    if (visible) hidden.add(elementId);
    else hidden.delete(elementId);
    onSettingsChange?.({ hiddenElementIds: [...hidden] });
  };

  return (
    <div className="space-y-2" data-testid="export-visibility-panel">
      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">👁 Visibilidade (Export)</p>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="export-show-tags" className="text-xs">
          Mostrar tags
        </Label>
        <Switch
          id="export-show-tags"
          checked={Boolean(settings.showTags)}
          onCheckedChange={(checked) => onSettingsChange?.({ showTags: checked })}
          disabled={disabled}
          data-testid="export-show-tags"
        />
      </div>
      {[...groups.entries()].map(([categoryId, categoryElements]) => {
        const categoryVisible = isCategoryVisible(settings, categoryId, elements);
        return (
          <div key={categoryId} className="space-y-1 border rounded p-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`cat-${categoryId}`}
                checked={categoryVisible}
                onCheckedChange={() => toggleCategory(categoryId)}
                disabled={disabled}
                data-testid={`export-category-${categoryId}`}
              />
              <Label htmlFor={`cat-${categoryId}`} className="text-xs font-medium capitalize">
                {categoryId}
              </Label>
            </div>
            <div className="pl-4 space-y-1">
              {categoryElements.map((el) => (
                <div key={el.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`el-${el.id}`}
                    checked={isElementVisible(settings, el.id, elements)}
                    onCheckedChange={() => toggleElement(el.id, categoryId)}
                    disabled={disabled || !categoryVisible}
                    data-testid={`export-element-${el.id}`}
                  />
                  <Label htmlFor={`el-${el.id}`} className="text-[10px] truncate">
                    {el.name || el.id}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
