import React, { lazy, Suspense, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Download, CloudOff } from 'lucide-react';
import { toast } from 'sonner';
import { isOnline } from '@/lib/offline/connectivity';
import {
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Plus, Pencil, Trash2, Map as MapIcon, FolderOpen, Layers, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import AppShell, { IDENTITY_CARD_CLASS } from '@/components/layout/AppShell';

const LeafletMap = lazy(() => import('@/components/map/LeafletMap'));

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [preparedMapIds, setPreparedMapIds] = useState([]);
  const [offlineMode] = useState(() => !isOnline());
  const [showCreate, setShowCreate] = useState(false);
  const [editMap, setEditMap] = useState(null);
  const [publishMap, setPublishMap] = useState(null);
  const [publishConfirmEmpty, setPublishConfirmEmpty] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'

  const { data: maps = [], isLoading } = useQuery({
    queryKey: ['maps'],
    queryFn: () => api.entities.Map.list('-created_date'),
  });

  React.useEffect(() => {
    api.offline.listPreparedMaps().then((prepared) => setPreparedMapIds(prepared.map((m) => m.id))).catch(() => {});
  }, [maps.length]);

  const { data: allElements = [] } = useQuery({
    queryKey: ['all-elements', maps.map((m) => m.id).join(',')],
    queryFn: async () => {
      const lists = await Promise.all(
        maps.map((m) => api.entities.MapElement.filter({ map_id: m.id }))
      );
      return lists.flat();
    },
    enabled: viewMode === 'map' && maps.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Map.create(data),
    onSuccess: (newMap) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      setShowCreate(false);
      setFormData({ name: '', description: '' });
      navigate(`/editor/${newMap.id}`);
    },
    onError: (err) => toast.error(err.message || 'Falha ao criar mapa'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Map.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      setEditMap(null);
      setFormData({ name: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }) => api.entities.Map.delete(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maps'] }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, confirmEmpty, baseVersion }) =>
      api.entities.Map.publish(id, { confirmEmpty, baseVersion }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      setPublishMap(null);
      setPublishConfirmEmpty(false);
      toast.success('Mapa publicado na galeria');
    },
    onError: (err) => {
      if (err.code === 'confirmation_required') {
        setPublishConfirmEmpty(true);
        return;
      }
      toast.error(err.message || 'Falha ao publicar mapa');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: ({ id, version }) => api.entities.Map.unpublish(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      toast.success('Mapa removido da galeria pública');
    },
    onError: (err) => toast.error(err.message || 'Falha ao despublicar mapa'),
  });

  const handleCreate = () => {
    createMutation.mutate({ ...formData, center_lat: -32.035, center_lng: -52.1, zoom: 13 });
  };

  const handleUpdate = () => {
    const data = { ...formData };
    if (editMap?.version != null) {
      data.base_version = editMap.version;
    }
    updateMutation.mutate({ id: editMap.id, data });
  };

  const handlePrepareOffline = async (mapId, e) => {
    e?.stopPropagation?.();
    try {
      await api.entities.Map.prepareOffline(mapId);
      setPreparedMapIds((prev) => [...new Set([...prev, mapId])]);
      toast.success('Mapa preparado para uso offline');
    } catch (err) {
      toast.error(err.message || 'Falha ao preparar mapa offline');
    }
  };

  const openEdit = (map) => {
    setEditMap(map);
    setFormData({ name: map.name, description: map.description || '' });
  };

  return (
    <AppShell
      showHomeLink={false}
      title={viewMode === 'list' ? 'Meus Mapas' : undefined}
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          className={`text-primary-foreground hover:bg-primary-foreground/20 gap-2 ${viewMode === 'map' ? 'bg-primary-foreground/20' : ''}`}
          onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
        >
          {viewMode === 'list' ? <MapIcon className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          <span>{viewMode === 'list' ? 'Ver Mapa' : 'Ver Lista'}</span>
        </Button>
      }
      actions={
        viewMode === 'list' ? (
          <Button onClick={() => { setFormData({ name: '', description: '' }); setShowCreate(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Novo Mapa
          </Button>
        ) : null
      }
    >
        {viewMode === 'list' ? (
          <>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : maps.length === 0 && offlineMode ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <CloudOff className="w-16 h-16 text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhum mapa offline disponível</h3>
                  <p className="text-muted-foreground">Prepare mapas enquanto estiver online para editá-los offline.</p>
                </CardContent>
              </Card>
            ) : maps.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="w-16 h-16 text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhum mapa criado ainda</h3>
                  <p className="text-muted-foreground mb-6">Crie seu primeiro mapa colaborativo</p>
                  <Button onClick={() => setShowCreate(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Criar Meu Primeiro Mapa
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {maps.map((map) => (
                  <Card key={map.id} className={`group hover:shadow-lg transition-all duration-200 cursor-pointer ${IDENTITY_CARD_CLASS}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0" onClick={() => navigate(`/editor/${map.id}`)}>
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                            <h3 className="font-semibold text-foreground truncate">{map.name}</h3>
                            {preparedMapIds.includes(map.id) && (
                              <Badge variant="secondary" className="text-[10px]">Offline</Badge>
                            )}
                            {map.is_published ? (
                              <Badge className="text-[10px] bg-green-600">Publicado</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Privado</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {map.description || 'Sem descrição'}
                          </p>
                          {map.is_published && map.public_id && (
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/gallery/${map.public_id}`);
                              }}
                            >
                              Ver na galeria pública
                            </button>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {map.created_at || map.created_date
                              ? format(new Date(map.created_at || map.created_date), "dd/MM/yyyy 'às' HH:mm")
                              : ''}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {map.is_published ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Despublicar"
                              disabled={unpublishMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                unpublishMutation.mutate({ id: map.id, version: map.version });
                              }}
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Publicar"
                              disabled={publishMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPublishMap(map);
                                setPublishConfirmEmpty(false);
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Preparar offline" onClick={(e) => handlePrepareOffline(map.id, e)}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(map); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: map.id, version: map.version }); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="h-[70vh] rounded-2xl overflow-hidden border shadow-xl relative">
            <Suspense fallback={<div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
            <LeafletMap 
              center={[-32.035, -52.1]} 
              zoom={12} 
              elements={allElements} 
              activeTool="select"
              onNewElement={() => {}}
              onElementLongPress={() => {}}
            />
            </Suspense>
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 max-w-[220px]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 shadow-lg w-fit bg-card/95 backdrop-blur-sm"
                onClick={() => setViewMode('list')}
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar à lista
              </Button>
              <div className="bg-card/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg">
                <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Mapa Principal</h3>
                <p className="text-[10px] text-muted-foreground">Exibindo todos os elementos de todos os seus mapas.</p>
              </div>
            </div>
          </div>
        )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Mapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Mapa</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Mapeamento Rio Grande" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descreva o mapa..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!formData.name || createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar e Abrir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editMap} onOpenChange={(open) => !open && setEditMap(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Mapa</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMap(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={!formData.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!publishMap} onOpenChange={(open) => !open && setPublishMap(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar mapa na galeria?</DialogTitle>
            <DialogDescription>
              Ao publicar, o nome, descrição, elementos e fotos deste mapa ficarão visíveis para qualquer
              visitante anônimo. Revise o conteúdo antes de continuar.
            </DialogDescription>
          </DialogHeader>
          {publishConfirmEmpty && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              Este mapa não possui elementos. Confirme que deseja publicar um mapa vazio.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishMap(null)}>Cancelar</Button>
            <Button
              onClick={() =>
                publishMutation.mutate({
                  id: publishMap.id,
                  confirmEmpty: publishConfirmEmpty,
                  baseVersion: publishMap?.version,
                })
              }
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? 'Publicando...' : 'Publicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}