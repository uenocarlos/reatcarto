import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildMemorial, MemorialGeometryError } from '@/lib/memorial/geometry';
import { saveMemorialPdf } from '@/lib/memorial/generateMemorialPdf';

function polygonLabel(element, index) {
  return element.name?.trim() || `Polígono sem nome ${index + 1}`;
}

function metric(value, suffix) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${suffix}`;
}

export default function MemorialDialog({ open, onOpenChange, elements = [], mapName = '' }) {
  const polygons = useMemo(
    () => elements.filter((element) => element.element_type === 'polygon'),
    [elements],
  );
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId((current) => (
      polygons.some((polygon) => String(polygon.id) === current)
        ? current
        : String(polygons[0]?.id ?? '')
    ));
    setTitle((current) => current || `Memorial Descritivo - ${mapName || 'ReatCarto'}`);
  }, [open, polygons, mapName]);

  const selectedPolygon = polygons.find((polygon) => String(polygon.id) === selectedId);
  const preview = useMemo(() => {
    if (!selectedPolygon) return null;
    try {
      return buildMemorial(selectedPolygon);
    } catch {
      return null;
    }
  }, [selectedPolygon]);

  const handleGenerate = () => {
    if (!selectedPolygon) {
      toast.error('Selecione um polígono.');
      return;
    }
    if (!title.trim()) {
      toast.error('Informe o título do memorial.');
      return;
    }
    setGenerating(true);
    try {
      const memorial = buildMemorial(selectedPolygon);
      const result = saveMemorialPdf({
        memorial,
        title: title.trim(),
        mapName,
        polygonName: selectedPolygon.name || 'Polígono sem nome',
      });
      toast.success(`Memorial gerado: ${result.fileName}`);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof MemorialGeometryError
        ? error.message
        : 'Não foi possível gerar o memorial descritivo.';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Memorial descritivo
          </DialogTitle>
          <DialogDescription>
            Selecione um polígono e gere a tabela de coordenadas UTM, lados, azimutes e distâncias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto pr-1">
          <div className="space-y-2">
            <label htmlFor="memorial-title" className="text-sm font-medium">Título do documento</label>
            <Input
              id="memorial-title"
              value={title}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Memorial Descritivo Sintético"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">Polígono</legend>
            {polygons.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Este mapa ainda não possui polígonos. Desenhe e salve um polígono antes de gerar o memorial.
              </div>
            ) : (
              <div className="rounded-lg border max-h-56 overflow-y-auto divide-y">
                {polygons.map((polygon, index) => {
                  const id = String(polygon.id);
                  return (
                    <label key={id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/60">
                      <input
                        type="radio"
                        name="memorial-polygon"
                        value={id}
                        checked={selectedId === id}
                        onChange={() => setSelectedId(id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{polygonLabel(polygon, index)}</span>
                        {polygon.description ? (
                          <span className="block text-xs text-muted-foreground truncate">{polygon.description}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          {preview ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-muted/50 p-3">
              <div><p className="text-[10px] uppercase text-muted-foreground">Sistema</p><p className="text-sm font-medium">UTM {preview.zoneLabel}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Vértices</p><p className="text-sm font-medium">{preview.vertexCount}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Área</p><p className="text-sm font-medium">{metric(preview.area, 'm²')}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Perímetro</p><p className="text-sm font-medium">{metric(preview.perimeter, 'm')}</p></div>
            </div>
          ) : selectedPolygon ? (
            <p className="text-sm text-destructive">A geometria selecionada não forma um polígono válido.</p>
          ) : null}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={!selectedPolygon || !preview || generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
