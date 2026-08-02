import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Copy, Clipboard } from 'lucide-react';

export default function ElementContextMenu({ position, elementType, hasCopiedStyle, copiedStyleType, onEdit, onDelete, onCopy, onCopyStyle, onPasteStyle, onClose }) {
  if (!position) return null;

  const canPasteStyle = hasCopiedStyle && copiedStyleType === elementType;

  return (
    <>
      <div className="fixed inset-0 z-[1002]" onClick={onClose} />
      <div
        className="absolute z-[1003] bg-card rounded-xl shadow-xl border p-1.5 min-w-[160px]"
        style={{ left: position.x, top: position.y }}
      >
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
          Excluir
        </Button>
        {elementType === 'point' && (
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onCopy}>
            <Copy className="w-3.5 h-3.5" />
            Copiar
          </Button>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onCopyStyle}>
          <Clipboard className="w-3.5 h-3.5" />
          Copiar Formatação
        </Button>
        {canPasteStyle && (
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs font-medium text-primary" onClick={onPasteStyle}>
            <Clipboard className="w-3.5 h-3.5" />
            Colar Formatação
          </Button>
        )}
      </div>
    </>
  );
}