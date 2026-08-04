import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

/**
 * Owner-only export entry control (ADR-002).
 */
export default function ExportEntry({ onOpen, disabled = false, disabledReason }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={onOpen}
      disabled={disabled}
      aria-label="Exportar mapa"
      data-testid="export-entry-button"
      title={disabledReason || 'Exportar mapa'}
    >
      <Download className="w-4 h-4" />
      Exportar
    </Button>
  );
}
