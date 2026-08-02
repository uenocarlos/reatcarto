import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Globe, MapPin } from 'lucide-react';
import LeafletMap from '@/components/map/LeafletMap';

export default function PublicMapView() {
  const { publicId } = useParams();
  const [selectedElement, setSelectedElement] = useState(null);

  const {
    data: map,
    isLoading: mapLoading,
    isError: mapError,
    error: mapErr,
    refetch: refetchMap,
  } = useQuery({
    queryKey: ['public-map', publicId],
    queryFn: () => api.public.getMap(publicId),
    retry: false,
  });

  const { data: elementsData, isLoading: elementsLoading } = useQuery({
    queryKey: ['public-elements', publicId],
    queryFn: () => api.public.listElements(publicId),
    enabled: !!map,
    retry: false,
  });

  const elements = elementsData?.elements ?? [];
  const isNotFound = mapError && mapErr instanceof ApiError && mapErr.status === 404;
  const isNetwork = mapError && mapErr instanceof ApiError && mapErr.code === 'network_error';

  if (mapLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h1 className="text-xl font-semibold mb-2">Mapa indisponível</h1>
        <p className="text-muted-foreground mb-6">
          Este mapa não está publicado ou não existe mais.
        </p>
        <Button asChild>
          <Link to="/gallery">Voltar à galeria</Link>
        </Button>
      </div>
    );
  }

  if (isNetwork) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
        <h1 className="text-xl font-semibold mb-2">Conexão indisponível</h1>
        <p className="text-muted-foreground mb-6">
          Não foi possível carregar o mapa. Verifique sua conexão e tente novamente.
        </p>
        <Button onClick={() => refetchMap()}>Tentar novamente</Button>
      </div>
    );
  }

  if (!map) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-background font-inter">
      <header className="bg-primary shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" asChild>
            <Link to="/gallery">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-primary-foreground truncate">{map.name}</h1>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                <Globe className="w-3 h-3 mr-1" /> Somente leitura
              </Badge>
            </div>
            {map.description && (
              <p className="text-primary-foreground/80 text-xs truncate">{map.description}</p>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 relative min-h-0">
        {elementsLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : null}
        <LeafletMap
          center={[map.center_lat, map.center_lng]}
          zoom={map.zoom}
          elements={elements}
          activeTool="select"
          readOnly
          onNewElement={() => {}}
          onElementLongPress={(el) => setSelectedElement(el)}
        />
      </div>

      <Dialog open={!!selectedElement} onOpenChange={(open) => !open && setSelectedElement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedElement?.name || 'Elemento'}</DialogTitle>
          </DialogHeader>
          {selectedElement?.description && (
            <p className="text-sm text-muted-foreground">{selectedElement.description}</p>
          )}
          {selectedElement?.photos?.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {selectedElement.photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url || api.public.getPhoto(photo.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border"
                >
                  <img
                    src={photo.url || api.public.getPhoto(photo.id)}
                    alt=""
                    className="w-full h-32 object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
