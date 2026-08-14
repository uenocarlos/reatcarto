import React, { useState } from 'react';
import { ArrowLeft, Download, MoreVertical, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { EDITOR_DOCK_CLASS, EDITOR_DOCK_BUTTON_CLASS } from '@/components/map/editorChrome';
import EditorActionsPanel from '@/components/map/EditorActionsPanel';

function StatusChip({ children, onClick, variant = 'default' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
        variant === 'offline'
          ? 'border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          : 'border border-primary/30 bg-primary/10 text-primary'
      )}
    >
      {children}
    </button>
  );
}

/**
 * Barra superior flutuante do editor — HUD compatível com MapToolbar e controles do mapa.
 */
export default function EditorTopDock({
  mapName = 'Carregando...',
  pendingCount = 0,
  offline = false,
  compact = false,
  onBack,
  citySearch,
  locateControl,
  onExport,
  onMemorial,
  onGisExport,
  onPublish,
  onUnpublish,
  isPublished = false,
  publishDisabled = false,
  publishDisabledReason,
  unpublishDisabled = false,
  onSync,
  onStatusClick,
  exportDisabled = false,
  exportDisabledReason,
  gisExportDisabled = false,
  gisExportDisabledReason,
  memorialDisabled = false,
  memorialDisabledReason,
  className,
}) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const panelProps = {
    mapName,
    pendingCount,
    offline,
    onMemorial: () => { closeMenu(); onMemorial?.(); },
    onGisExport: () => { closeMenu(); onGisExport?.(); },
    onPublish: () => { closeMenu(); onPublish?.(); },
    onUnpublish: () => { closeMenu(); onUnpublish?.(); },
    isPublished,
    publishDisabled,
    publishDisabledReason,
    unpublishDisabled,
    onSync: () => { closeMenu(); onSync?.(); },
    gisExportDisabled,
    gisExportDisabledReason,
    memorialDisabled,
    memorialDisabledReason,
  };

  const moreButton = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className={cn(EDITOR_DOCK_BUTTON_CLASS, 'bg-background/80 shadow-sm border')}
      aria-label="Mais ações"
    >
      <MoreVertical className="h-4 w-4" />
    </Button>
  );

  const exportButton = (
    <Button
      type="button"
      size="sm"
      className="h-9 shrink-0 gap-1.5 rounded-xl px-3"
      onClick={onExport}
      disabled={exportDisabled}
      title={exportDisabledReason || 'Exportar mapa'}
      data-testid="export-entry-button"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Exportar</span>
    </Button>
  );

  const actionsMenu = isMobile ? (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn(EDITOR_DOCK_BUTTON_CLASS, 'bg-background/80 shadow-sm border')}
        aria-label="Mais ações"
        onClick={() => setMenuOpen(true)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent className="z-[1100] max-h-[85vh]">
          <DrawerTitle className="sr-only">Ações do mapa</DrawerTitle>
          <div className="overflow-y-auto pb-6">
            <EditorActionsPanel {...panelProps} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  ) : (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>{moreButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-[1100] w-72 p-0 overflow-hidden"
      >
        <EditorActionsPanel {...panelProps} />
      </PopoverContent>
    </Popover>
  );

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-3 top-3 z-[1002] flex justify-center',
        className
      )}
    >
      <div className={cn(EDITOR_DOCK_CLASS, 'pointer-events-auto w-full p-1.5 md:w-auto')}>
        {/* Linha principal */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={EDITOR_DOCK_BUTTON_CLASS}
            onClick={onBack}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1 md:flex-none md:max-w-[11rem]">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="truncate text-sm font-bold leading-none">
                {mapName}
              </h1>
              {offline ? (
                <StatusChip variant="offline" onClick={onStatusClick}>
                  <CloudOff className="mr-0.5 inline h-2.5 w-2.5" />
                  Offline
                </StatusChip>
              ) : null}
              {pendingCount > 0 ? (
                <StatusChip onClick={onStatusClick}>
                  {pendingCount} pend.
                </StatusChip>
              ) : null}
            </div>
            {!compact ? (
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Gerador de mapas
              </p>
            ) : null}
          </div>

          {!isMobile ? (
            <div className="hidden md:flex items-center gap-1.5 w-56 shrink-0">
              <div className="min-w-0 flex-1">{citySearch}</div>
              {locateControl}
            </div>
          ) : null}

          <div className="flex shrink-0 items-center gap-1">
            {exportButton}
            {actionsMenu}
          </div>
        </div>

        {/* Busca — mobile */}
        {!compact && isMobile ? (
          <div className="mt-1.5 flex items-center gap-2 border-t border-border/60 pt-1.5">
            <div className="min-w-0 flex-1">{citySearch}</div>
            {locateControl}
          </div>
        ) : null}
      </div>
    </div>
  );
}
