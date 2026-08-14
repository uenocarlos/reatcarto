import React from 'react';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

/**
 * Barra fixa no mobile durante edição de geometria no mapa.
 */
export default function MobileGeometryEditBar({ elementType, onCancel, onFinish }) {
  const hint =
    elementType === 'point'
      ? 'Arraste o ponto para reposicionar'
      : 'Arraste os vértices ou os pontos intermediários para ajustar';

  return (
    <>
      <div className="fixed top-[7.5rem] inset-x-3 z-[1002] pointer-events-none md:top-[5.5rem]">
        <div className="mx-auto max-w-md rounded-full border bg-card/95 px-4 py-2 text-center text-xs font-medium shadow-lg backdrop-blur-sm">
          {hint}
        </div>
      </div>

      <div className="fixed bottom-4 inset-x-3 z-[1002] flex gap-2">
        <Button type="button" variant="outline" className="flex-1 h-11 bg-card" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" className="flex-[2] h-11 gap-2" onClick={onFinish}>
          <Save className="w-4 h-4" />
          Salvar
        </Button>
      </div>
    </>
  );
}
