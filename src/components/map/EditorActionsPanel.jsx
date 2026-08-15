import React from 'react';
import {
  FileText,
  FileJson,
  Globe,
  EyeOff,
  CloudOff,
  Download,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function PanelSection({ title, children, className }) {
  return (
    <div className={cn('border-b last:border-b-0', className)}>
      {title ? (
        <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function PanelRow({ icon: Icon, label, description, onClick, disabled, destructive, hint, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      data-testid={testId}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/80 disabled:opacity-50 disabled:pointer-events-none',
        destructive && 'text-destructive'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-none">{label}</span>
        {description ? (
          <span className="mt-1 block text-[11px] text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

/**
 * Conteúdo do menu de ações do mapa (desktop popover / mobile drawer).
 */
export default function EditorActionsPanel({
  mapName,
  pendingCount = 0,
  offline = false,
  onMemorial,
  onGisExport,
  onPublish,
  onUnpublish,
  isPublished = false,
  publishDisabled = false,
  publishDisabledReason,
  unpublishDisabled = false,
  onPrepareOffline,
  offlinePrepared = false,
  prepareOfflineDisabled = false,
  prepareOfflineDisabledReason,
  prepareOfflineBusy = false,
  onSync,
  gisExportDisabled = false,
  gisExportDisabledReason,
  memorialDisabled = false,
  memorialDisabledReason,
  className,
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="border-b px-3 py-3 shrink-0">
        <p className="text-sm font-semibold leading-none">Ações do mapa</p>
        {mapName ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">{mapName}</p>
        ) : null}
      </div>

      <PanelSection>
        <PanelRow
          icon={FileText}
          label="Memorial descritivo"
          onClick={onMemorial}
          disabled={memorialDisabled}
          hint={memorialDisabledReason}
        />
        <PanelRow
          icon={FileJson}
          label="GeoJSON / Shapefile"
          description="Dados vetoriais para GIS"
          onClick={onGisExport}
          disabled={gisExportDisabled}
          hint={gisExportDisabledReason}
        />
      </PanelSection>

      <PanelSection title="Mapa">
        {isPublished ? (
          <PanelRow
            icon={EyeOff}
            label="Despublicar da galeria"
            description="Tornar o mapa privado novamente"
            onClick={onUnpublish}
            disabled={unpublishDisabled}
          />
        ) : (
          <PanelRow
            icon={Globe}
            label="Publicar na galeria"
            description="Tornar visível publicamente"
            onClick={onPublish}
            disabled={publishDisabled}
            hint={publishDisabledReason}
          />
        )}
        <PanelRow
          icon={Download}
          label="Usar o mapa offline"
          description={
            prepareOfflineBusy
              ? 'Preparando mapa para uso offline...'
              : offlinePrepared
                ? 'Já disponível offline — toque para atualizar'
                : 'Baixar este mapa para editar sem internet'
          }
          onClick={onPrepareOffline}
          disabled={prepareOfflineDisabled}
          hint={prepareOfflineDisabledReason || 'Preparar mapa para uso offline'}
          testId="prepare-offline-entry"
        />
      </PanelSection>

      {(pendingCount > 0 || offline) ? (
        <PanelSection title="Sincronização">
          <div className="space-y-2 px-3 pb-3">
            {offline ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CloudOff className="h-3.5 w-3.5 shrink-0" />
                Trabalhando offline
              </div>
            ) : null}
            {pendingCount > 0 ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                {pendingCount} alteração{pendingCount !== 1 ? 'ões' : ''} pendente{pendingCount !== 1 ? 's' : ''}
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full gap-2 text-xs"
              onClick={onSync}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sincronizar agora
            </Button>
          </div>
        </PanelSection>
      ) : null}
    </div>
  );
}
