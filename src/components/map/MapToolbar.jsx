import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MapPin, Minus, Pentagon, Hand, Navigation, Pencil, MousePointer } from 'lucide-react';

export default function MapToolbar({ activeTool, onToolChange, onDrawingMode, disabled }) {
  const [pointOpen, setPointOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [polygonOpen, setPolygonOpen] = useState(false);

  const handleSelect = (tool, mode, setOpen) => {
    if (disabled) return;
    onToolChange(tool);
    onDrawingMode(mode);
    setOpen(false);
  };

  return (
    <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-card/95 backdrop-blur-sm rounded-2xl shadow-2xl border p-2 flex gap-1 items-center max-w-[95vw] overflow-x-auto no-scrollbar ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <Button
        variant={activeTool === 'select' ? 'default' : 'ghost'}
        size="icon"
        className="h-10 w-10 shrink-0 rounded-xl"
        onClick={() => { if (!disabled) { onToolChange('select'); onDrawingMode(null); } }}
        disabled={disabled}
        title="Selecionar"
      >
        <Hand className="w-5 h-5" />
      </Button>

      <div className="w-px h-6 bg-border mx-1 shrink-0" />

      {/* Point */}
      <Popover open={pointOpen && !disabled} onOpenChange={(val) => !disabled && setPointOpen(val)}>
        <PopoverTrigger asChild>
          <Button
            variant={activeTool === 'point' ? 'default' : 'ghost'}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            disabled={disabled}
            title="Adicionar Ponto"
          >
            <MapPin className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 mb-2" align="center" side="top">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">Adicionar Ponto</p>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-xs h-9" onClick={() => handleSelect('point', 'manual', setPointOpen)}>
              <MousePointer className="w-4 h-4 text-primary" />
              Inserir manualmente
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-xs h-9" onClick={() => handleSelect('point', 'gps', setPointOpen)}>
              <Navigation className="w-4 h-4 text-primary" />
              Usar minha localização
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Line */}
      <Popover open={lineOpen && !disabled} onOpenChange={(val) => !disabled && setLineOpen(val)}>
        <PopoverTrigger asChild>
          <Button
            variant={activeTool === 'line' ? 'default' : 'ghost'}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            disabled={disabled}
            title="Desenhar Linha"
          >
            <Minus className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 mb-2" align="center" side="top">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">Desenhar Linha</p>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-xs h-9" onClick={() => handleSelect('line', 'freehand', setLineOpen)}>
              <Pencil className="w-4 h-4 text-primary" />
              Mão livre
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-xs h-9" onClick={() => handleSelect('line', 'point-by-point', setLineOpen)}>
              <MousePointer className="w-4 h-4 text-primary" />
              Ponto a ponto
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-xs h-9" onClick={() => handleSelect('line', 'gps-track', setLineOpen)}>
              <Navigation className="w-4 h-4 text-primary" />
              Rastrear GPS
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Polygon */}
      <Popover open={polygonOpen && !disabled} onOpenChange={(val) => !disabled && setPolygonOpen(val)}>
        <PopoverTrigger asChild>
          <Button
            variant={activeTool === 'polygon' ? 'default' : 'ghost'}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            disabled={disabled}
            title="Desenhar Polígono"
          >
            <Pentagon className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 mb-2" align="center" side="top">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">Desenhar Polígono</p>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-xs h-9" onClick={() => handleSelect('polygon', 'freehand', setPolygonOpen)}>
              <Pencil className="w-4 h-4 text-primary" />
              Mão livre
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-xs h-9" onClick={() => handleSelect('polygon', 'point-by-point', setPolygonOpen)}>
              <MousePointer className="w-4 h-4 text-primary" />
              Ponto a ponto
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-xs h-9" onClick={() => handleSelect('polygon', 'gps-track', setPolygonOpen)}>
              <Navigation className="w-4 h-4 text-primary" />
              Rastrear GPS
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
