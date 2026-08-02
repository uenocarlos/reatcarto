import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation, Square, Loader2 } from 'lucide-react';

export default function GpsTracker({ isActive, onFinish, onCancel }) {
  const [tracking, setTracking] = useState(false);
  const [points, setPoints] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const watchRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      stopTracking();
    }
    return () => stopTracking();
  }, [isActive]);

  const startTracking = () => {
    if (!navigator.geolocation) return;
    setTracking(true);
    setPoints([]);
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPoint = [pos.coords.latitude, pos.coords.longitude];
        setPoints(prev => [...prev, newPoint]);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  };

  const stopTracking = () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTracking(false);
  };

  const handleFinish = () => {
    stopTracking();
    onFinish(points);
    setPoints([]);
    setElapsed(0);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (!isActive) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000] bg-card rounded-xl shadow-lg border p-4 min-w-[260px]">
      <div className="text-center mb-3">
        <p className="text-xs text-muted-foreground mb-1">Rastreamento GPS</p>
        {tracking && (
          <>
            <p className="text-2xl font-bold font-inter tabular-nums">{formatTime(elapsed)}</p>
            <p className="text-xs text-muted-foreground">{points.length} pontos capturados</p>
          </>
        )}
      </div>

      {!tracking ? (
        <div className="flex gap-2">
          <Button onClick={startTracking} className="flex-1 gap-2" size="sm">
            <Navigation className="w-4 h-4" />
            Iniciar
          </Button>
          <Button variant="outline" onClick={onCancel} size="sm">
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button onClick={handleFinish} variant="destructive" className="flex-1 gap-2" size="sm">
            <Square className="w-3 h-3" />
            Finalizar
          </Button>
        </div>
      )}

      {tracking && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span className="text-xs text-primary font-medium">Rastreando...</span>
        </div>
      )}
    </div>
  );
}