import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { isIconLibraryEmpty } from '@/lib/icons/stylePanelIconHelpers';

/**
 * @param {{
 *   icons: Array<{ id: string, name: string, url: string }>,
 *   selectedUrl?: string,
 *   onSelect: (icon: { id: string, name: string, url: string }) => void,
 *   onRemove: (icon: { id: string, name: string, url: string }) => void,
 *   removingId?: string | null,
 * }} props
 */
export default function IconLibraryList({
  icons,
  selectedUrl = '',
  onSelect,
  onRemove,
  removingId = null,
}) {
  if (isIconLibraryEmpty(icons)) {
    return (
      <p className="text-[11px] text-muted-foreground leading-snug text-center py-8">
        Nenhum ícone salvo ainda. No desktop você poderá desenhar e salvar ícones na biblioteca.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {icons.map((icon) => {
        const isSelected = selectedUrl === icon.url;
        return (
          <div key={icon.id} className="relative group">
            <button
              type="button"
              title={icon.name}
              className={`aspect-square w-full flex items-center justify-center rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-primary bg-primary/20 shadow-inner'
                  : 'border-transparent hover:bg-accent hover:border-muted-foreground/20'
              }`}
              onClick={() => onSelect(icon)}
            >
              <img
                src={icon.url}
                alt=""
                className="w-6 h-6 object-contain pointer-events-none"
              />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-background/90 shadow-sm text-destructive hover:text-destructive"
              disabled={removingId === icon.id}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(icon);
              }}
              title="Remover da biblioteca"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
