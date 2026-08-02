import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Globe, AlertCircle, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";

export default function OfflineTileModal({ open, onClose, mapInstance }) {
  const [clearing, setClearing] = useState(false);
  const [stats, setStats] = useState({ exists: false, size: '0 MB' });

  useEffect(() => {
    if (open) {
      updateStats();
    }
  }, [open]);

  const updateStats = async () => {
    try {
      const result = await Filesystem.readdir({
        path: 'tile_cache',
        directory: Directory.Data,
      });
      setStats({ exists: result.files.length > 0, size: 'Calculando...' });
      // Here you could implement a recursive size calculation if needed
    } catch (e) {
      setStats({ exists: false, size: '0 MB' });
    }
  };

  const handleClear = async () => {
    if (confirm("Deseja apagar todo o cache de mapas salvos automaticamente?")) {
      setClearing(true);
      try {
        await Filesystem.rmdir({
          path: 'tile_cache',
          directory: Directory.Data,
          recursive: true,
        });
        toast.success("Cache do mapa limpo!");
        updateStats();
      } catch (e) {
        console.error('Failed to clear cache:', e);
        toast.error("Erro ao limpar cache.");
      } finally {
        setClearing(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Cache do Mapa
          </DialogTitle>
          <DialogDescription>
            O aplicativo salva automaticamente as partes do mapa que você visualiza para uso offline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg space-y-3 text-center">
            <div className="flex flex-col items-center gap-2">
              <MapIcon className={`w-8 h-8 ${stats.exists ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-medium">
                {stats.exists ? 'Existem dados de mapa em cache' : 'O cache está vazio'}
              </p>
            </div>
            
            {stats.exists && (
              <Button 
                variant="destructive" 
                className="w-full gap-2 mt-2" 
                onClick={handleClear}
                disabled={clearing}
              >
                <Trash2 className="w-4 h-4" />
                {clearing ? 'Limpando...' : 'Apagar Cache de Mapas'}
              </Button>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-primary/5 rounded border border-primary/10">
            <AlertCircle className="w-4 h-4 text-primary shrink-0" />
            <p>Novos dados são salvos automaticamente conforme você navega no mapa online.</p>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
