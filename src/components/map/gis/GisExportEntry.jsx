import React from 'react';
import { Button } from '@/components/ui/button';
import { FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GisExportEntry({ onOpen, disabled = false, disabledReason, className }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('gap-2', className)}
      onClick={onOpen}
      disabled={disabled}
      aria-label="Exportar GeoJSON ou Shapefile"
      data-testid="gis-export-entry"
      title={disabledReason || 'Exportar GeoJSON ou Shapefile'}
    >
      <FileJson className="w-4 h-4" />
      GeoJSON / SHP
    </Button>
  );
}
