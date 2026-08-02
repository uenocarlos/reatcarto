import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ConflictResolutionModal({ conflict, open, onResolve, onClose }) {
  const [choice, setChoice] = useState(null);

  if (!conflict) return null;

  const local = conflict.local_snapshot ?? {};
  const remote = conflict.remote_snapshot ?? {};

  const handleResolve = () => {
    if (!choice) return;
    onResolve(conflict.client_mutation_id, choice, local.base_version ?? remote.version);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conflito de sincronização</DialogTitle>
          <DialogDescription>
            Este item foi alterado localmente e no servidor. Escolha qual versão manter.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <button
            type="button"
            className={`text-left border rounded-lg p-4 ${choice === 'local' ? 'border-primary ring-2 ring-primary/30' : ''}`}
            onClick={() => setChoice('local')}
          >
            <Badge variant="outline" className="mb-2">Local</Badge>
            <pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap">
              {JSON.stringify(local, null, 2)}
            </pre>
          </button>
          <button
            type="button"
            className={`text-left border rounded-lg p-4 ${choice === 'remote' ? 'border-primary ring-2 ring-primary/30' : ''}`}
            onClick={() => setChoice('remote')}
          >
            <Badge variant="outline" className="mb-2">Servidor</Badge>
            <pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap">
              {JSON.stringify(remote, null, 2)}
            </pre>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!choice} onClick={handleResolve}>Aplicar escolha</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
