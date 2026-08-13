import React, { useState } from 'react';
import { Menu, FileText, Download, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

/**
 * Menu lateral (mobile) com ações do editor: memorial e exportação.
 */
export default function MobileEditorActionsMenu({
  onExport,
  onMemorial,
  onGisExport,
  exportDisabled = false,
  exportDisabledReason,
  gisExportDisabled = false,
  gisExportDisabledReason,
}) {
  const [open, setOpen] = useState(false);

  const handleExport = () => {
    setOpen(false);
    onExport?.();
  };

  const handleMemorial = () => {
    setOpen(false);
    onMemorial?.();
  };

  const handleGisExport = () => {
    setOpen(false);
    onGisExport?.();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-10 w-10 shrink-0 shadow-md bg-card border rounded-xl"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(18rem,85vw)] z-[1100]"
        overlayClassName="z-[1100]"
      >
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={handleMemorial}
          >
            <FileText className="w-4 h-4" />
            Memorial
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={handleGisExport}
            disabled={gisExportDisabled}
            title={gisExportDisabledReason || 'Exportar GeoJSON ou Shapefile'}
            data-testid="gis-export-entry"
            aria-label="Exportar GeoJSON ou Shapefile"
          >
            <FileJson className="w-4 h-4" />
            GeoJSON / SHP
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={handleExport}
            disabled={exportDisabled}
            title={exportDisabledReason || 'Exportar mapa'}
            data-testid="export-entry-button"
            aria-label="Exportar mapa"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
