import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import AppShell, { IDENTITY_CARD_CLASS } from '@/components/layout/AppShell';

export default function AdminMapIntervention() {
  const [mapId, setMapId] = useState('');
  const [reason, setReason] = useState('');
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editName, setEditName] = useState('');

  const loadMap = async () => {
    if (!reason.trim()) {
      toast.error('Informe um motivo antes de acessar o mapa.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.admin.getPrivateMap(mapId.trim(), reason.trim());
      setMapData(data);
      setEditName(data.map?.name || '');
      toast.success('Mapa carregado');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Falha ao carregar mapa');
      setMapData(null);
    } finally {
      setLoading(false);
    }
  };

  const moderate = async () => {
    if (!reason.trim()) {
      toast.error('Motivo obrigatório');
      return;
    }
    setLoading(true);
    try {
      await api.admin.moderateMap(mapId.trim(), reason.trim());
      toast.success('Mapa moderado');
      setMapData(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Falha na moderação');
    } finally {
      setLoading(false);
    }
  };

  const saveMapEdit = async () => {
    if (!reason.trim()) {
      toast.error('Motivo obrigatório');
      return;
    }
    setLoading(true);
    try {
      await api.admin.mutatePrivate(
        { action: 'update_map', map_id: mapId.trim(), payload: { name: editName } },
        reason.trim()
      );
      toast.success('Mapa atualizado');
      await loadMap();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Falha na edição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      title="Administração — Mapas"
      maxWidth="max-w-4xl"
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/admin/users">Usuários</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/audit">Auditoria</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Card className={IDENTITY_CARD_CLASS}>
          <CardHeader>
            <CardTitle>Intervenção em mapa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="ID do mapa" value={mapId} onChange={(e) => setMapId(e.target.value)} />
            <Textarea placeholder="Motivo obrigatório" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              <Button disabled={loading} onClick={loadMap}>
                Acessar mapa privado
              </Button>
              <Button variant="destructive" disabled={loading} onClick={moderate}>
                Moderar / ocultar público
              </Button>
            </div>
          </CardContent>
        </Card>

        {mapData && (
          <Card className={IDENTITY_CARD_CLASS}>
            <CardHeader>
              <CardTitle>{mapData.map?.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Publicado: {mapData.map?.is_published ? 'sim' : 'não'}
                {mapData.map?.moderation_reason && ` · Moderação: ${mapData.map.moderation_reason}`}
              </p>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Button disabled={loading} onClick={saveMapEdit}>
                Salvar edição administrativa
              </Button>
              <p className="text-sm">{mapData.elements?.length ?? 0} elementos</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
