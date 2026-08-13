import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Camera, Image as ImageIcon, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/apiClient';
import { isOnline } from '@/lib/offline/connectivity';
import { formatBytes } from '@/lib/media/formatBytes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IDENTITY_CARD_CLASS } from '@/components/layout/AppShell';

const PAGE_SIZE = 50;

function formatCreatedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'dd/MM/yyyy');
}

function usageLabel(item) {
  const elementName = (item.element_name || '').trim() || 'Elemento sem nome';
  const mapName = (item.map_name || '').trim() || 'Mapa sem nome';
  return `${elementName} · ${mapName}`;
}

function deleteErrorMessage(error, fallback) {
  if (error instanceof ApiError) return error.message || fallback;
  return error?.message || fallback;
}

export default function ProfileMediaLibrary() {
  const queryClient = useQueryClient();
  const online = isOnline();
  const [tab, setTab] = useState('photos');
  const [pendingDelete, setPendingDelete] = useState(null);

  const photosQuery = useQuery({
    queryKey: ['profile-photos'],
    queryFn: () => api.media.listPhotos({ page: 1, pageSize: PAGE_SIZE }),
    enabled: online,
    retry: false,
  });
  const videosQuery = useQuery({
    queryKey: ['profile-videos'],
    queryFn: () => api.media.listVideos({ page: 1, pageSize: PAGE_SIZE }),
    enabled: online,
    retry: false,
  });
  const iconsQuery = useQuery({
    queryKey: ['profile-icons'],
    queryFn: () => api.icons.list(),
    enabled: online,
    retry: false,
  });

  const photos = photosQuery.data?.photos ?? [];
  const videos = videosQuery.data?.videos ?? [];
  const icons = iconsQuery.data ?? [];
  const photoTotal = photosQuery.data?.pagination?.total ?? photos.length;
  const videoTotal = videosQuery.data?.pagination?.total ?? videos.length;

  const deletePhoto = useMutation({
    mutationFn: ({ id, version }) => api.media.delete(id, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile-photos'] });
      toast.success('Foto excluída');
    },
    onError: (error) => toast.error(deleteErrorMessage(error, 'Falha ao excluir foto')),
  });
  const deleteVideo = useMutation({
    mutationFn: ({ id, version }) => api.media.deleteVideo(id, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile-videos'] });
      toast.success('Vídeo excluído');
    },
    onError: (error) => toast.error(deleteErrorMessage(error, 'Falha ao excluir vídeo')),
  });
  const removeIcon = useMutation({
    mutationFn: ({ id }) => api.icons.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile-icons'] });
      toast.success('Ícone removido da biblioteca');
    },
    onError: (error) => toast.error(deleteErrorMessage(error, 'Falha ao remover ícone')),
  });

  const deleting = deletePhoto.isPending || deleteVideo.isPending || removeIcon.isPending;

  const confirmCopy = useMemo(() => {
    if (!pendingDelete) return { title: '', description: '' };
    if (pendingDelete.kind === 'photo') {
      return {
        title: 'Excluir esta foto?',
        description: `Ela será removida do elemento “${pendingDelete.item.element_name || 'sem nome'}” no mapa “${pendingDelete.item.map_name || 'sem nome'}”.`,
      };
    }
    if (pendingDelete.kind === 'video') {
      return {
        title: 'Excluir este vídeo?',
        description: `Ele será removido do elemento “${pendingDelete.item.element_name || 'sem nome'}” no mapa “${pendingDelete.item.map_name || 'sem nome'}”.`,
      };
    }
    return {
      title: 'Remover este ícone da biblioteca?',
      description:
        'O ícone some da biblioteca. Pontos que já o usam continuam mostrando-o no mapa.',
    };
  }, [pendingDelete]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { kind, item } = pendingDelete;
    try {
      if (kind === 'photo') {
        await deletePhoto.mutateAsync({ id: item.id, version: item.version });
      } else if (kind === 'video') {
        await deleteVideo.mutateAsync({ id: item.id, version: item.version });
      } else {
        await removeIcon.mutateAsync({ id: item.id });
      }
      setPendingDelete(null);
    } catch {
      // toast already handled by mutation
    }
  };

  return (
    <Card className={IDENTITY_CARD_CLASS}>
      <CardHeader>
        <CardTitle>Meus arquivos</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Veja e exclua fotos, vídeos e ícones que você criou ou adicionou. Excluir uma foto ou
          vídeo também remove o arquivo do elemento no mapa.
        </p>

        {!online ? (
          <p className="text-sm text-muted-foreground" role="status">
            Conecte-se à internet para gerenciar seus arquivos.
          </p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="photos">Fotos ({photoTotal})</TabsTrigger>
              <TabsTrigger value="videos">Vídeos ({videoTotal})</TabsTrigger>
              <TabsTrigger value="icons">Ícones ({icons.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="photos" className="mt-4">
              <MediaGrid
                loading={photosQuery.isLoading}
                error={photosQuery.isError}
                emptyTitle="Nenhuma foto ainda"
                emptyHint="As fotos que você anexar aos elementos dos mapas aparecem aqui."
                emptyIcon={Camera}
              >
                {photos.map((photo) => (
                  <MediaTile
                    key={photo.id}
                    title={usageLabel(photo)}
                    meta={`${formatBytes(photo.byte_size)} · ${formatCreatedAt(photo.created_at)}`}
                    mapId={photo.map_id}
                    onDelete={() => setPendingDelete({ kind: 'photo', item: photo })}
                  >
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  </MediaTile>
                ))}
              </MediaGrid>
            </TabsContent>

            <TabsContent value="videos" className="mt-4">
              <MediaGrid
                loading={videosQuery.isLoading}
                error={videosQuery.isError}
                emptyTitle="Nenhum vídeo ainda"
                emptyHint="Anexe MP4 ou WebM (até 20 MB) aos elementos no editor do mapa."
                emptyIcon={Video}
              >
                {videos.map((video) => (
                  <MediaTile
                    key={video.id}
                    title={usageLabel(video)}
                    meta={`${formatBytes(video.byte_size)} · ${formatCreatedAt(video.created_at)}`}
                    mapId={video.map_id}
                    onDelete={() => setPendingDelete({ kind: 'video', item: video })}
                  >
                    <video
                      src={video.url}
                      className="w-full h-full object-cover bg-muted"
                      muted
                      preload="metadata"
                      playsInline
                    />
                  </MediaTile>
                ))}
              </MediaGrid>
            </TabsContent>

            <TabsContent value="icons" className="mt-4">
              <MediaGrid
                loading={iconsQuery.isLoading}
                error={iconsQuery.isError}
                emptyTitle="Nenhum ícone na biblioteca"
                emptyHint="No desktop você pode desenhar e salvar ícones na biblioteca."
                emptyIcon={ImageIcon}
              >
                {icons.map((icon) => (
                  <MediaTile
                    key={icon.id}
                    title={icon.name || 'Ícone'}
                    meta={`${formatBytes(icon.byte_size)} · ${formatCreatedAt(icon.created_at)}`}
                    onDelete={() => setPendingDelete({ kind: 'icon', item: icon })}
                    previewClassName="bg-muted/40 p-4"
                  >
                    <img src={icon.url} alt="" className="w-10 h-10 object-contain mx-auto" />
                  </MediaTile>
                ))}
              </MediaGrid>
            </TabsContent>
          </Tabs>
        )}

        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
                onClick={(event) => {
                  event.preventDefault();
                  void confirmDelete();
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function MediaGrid({ loading, error, emptyTitle, emptyHint, emptyIcon: EmptyIcon, children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center" role="status">
        Carregando…
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-destructive py-6 text-center" role="alert">
        Não foi possível carregar estes arquivos.
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-8 px-4">
        <EmptyIcon className="w-8 h-8 text-muted-foreground mb-2" aria-hidden="true" />
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{emptyHint}</p>
      </div>
    );
  }
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{items}</div>;
}

function MediaTile({ title, meta, mapId, onDelete, children, previewClassName = '' }) {
  return (
    <div className="flex gap-3 rounded-lg border p-2">
      <div
        className={`w-20 h-20 shrink-0 overflow-hidden rounded-md border bg-muted ${previewClassName}`}
      >
        {children}
      </div>
      <div className="min-w-0 flex-1 flex flex-col">
        <p className="text-sm font-medium leading-snug truncate" title={title}>
          {title}
        </p>
        {meta ? <p className="text-xs text-muted-foreground mt-0.5">{meta}</p> : null}
        <div className="mt-auto flex items-center gap-2 pt-2">
          {mapId ? (
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link to={`/editor/${mapId}`}>Abrir mapa</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
