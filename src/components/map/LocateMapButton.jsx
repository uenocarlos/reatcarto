import React, { useState } from 'react';
import { Navigation } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

const VARIANT_CLASS = {
  map: 'h-12 w-12 shadow-lg bg-card border rounded-[12px]',
  header: 'h-9 w-9 shrink-0 rounded-xl border bg-background/90 shadow-sm',
};

const ICON_CLASS = {
  map: 'w-6 h-6 text-primary',
  header: 'w-4 h-4 text-primary',
};

/**
 * Localiza o usuário no GPS, centraliza o mapa e opcionalmente persiste a vista.
 */
export default function LocateMapButton({
  map = null,
  variant = 'header',
  className,
  userInteractedRef = null,
  onLocated,
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirmLocation = async () => {
    setShowPrompt(false);
    if (!map) {
      toast.error('Mapa ainda não está pronto');
      return;
    }

    setBusy(true);
    const toastId = toast.loading('Obtendo localização GPS...');
    if (userInteractedRef) userInteractedRef.current = true;

    const persistCurrentView = () => {
      const c = map.getCenter();
      onLocated?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };

    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      const view = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        zoom: 16,
      };
      onLocated?.(view);
      map.once('moveend', persistCurrentView);
      map.flyTo([view.lat, view.lng], view.zoom);
      toast.dismiss(toastId);
      toast.success('Mapa centralizado na sua localização');
    } catch (err) {
      console.error(err);
      try {
        map.once('moveend', persistCurrentView);
        map.locate({ setView: true, maxZoom: 16 });
        toast.dismiss(toastId);
        toast.success('Mapa centralizado na sua localização');
      } catch (fallbackErr) {
        toast.dismiss(toastId);
        toast.error('Não foi possível obter sua localização');
        console.error(fallbackErr);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn(VARIANT_CLASS[variant] || VARIANT_CLASS.header, className)}
        onClick={() => setShowPrompt(true)}
        disabled={!map || busy}
        title="Minha Localização"
        aria-label="Minha Localização"
      >
        <Navigation className={ICON_CLASS[variant] || ICON_CLASS.header} />
      </Button>

      <AlertDialog open={showPrompt} onOpenChange={setShowPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usar Localização?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja usar sua localização atual para navegar no mapa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLocation}>Sim, usar GPS</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
