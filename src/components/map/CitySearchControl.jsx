import React, { useEffect, useRef, useState } from 'react';
import { Search, Loader2, X, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchCities } from '@/lib/geocodeCities';
import { cn } from '@/lib/utils';

/**
 * Barra de pesquisa de cidades (header do editor).
 * Recebe a instância Leaflet via prop `map`.
 */
export default function CitySearchControl({ map = null, enabled = true, className }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const center = map?.getCenter?.();
        const items = await searchCities(q, {
          signal: controller.signal,
          limit: 7,
          bias: center ? { lat: center.lat, lng: center.lng } : undefined,
        });
        if (!controller.signal.aborted) {
          setResults(items);
          setOpen(true);
          setLoading(false);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setResults([]);
        setError('Não foi possível buscar municípios');
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, map, enabled]);

  useEffect(
    () => () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  if (!enabled) return null;

  const handleSelect = (place) => {
    setQuery(place.label);
    setOpen(false);
    setResults([]);

    if (!map) return;
    if (place.bbox) {
      map.fitBounds(place.bbox, { padding: [40, 40], maxZoom: Math.min(place.zoom + 1, 16) });
    } else {
      map.flyTo([place.lat, place.lng], place.zoom, { duration: 1.2 });
    }
  };

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setError(null);
  };

  return (
    <div ref={rootRef} className={cn('relative w-full max-w-md', className)}>
      <div className="relative flex items-center rounded-full border bg-background shadow-sm">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0 || query.trim().length >= 2) setOpen(true);
          }}
          placeholder="Buscar município..."
          className="h-9 border-0 bg-transparent pl-9 pr-9 shadow-none focus-visible:ring-0 rounded-full"
          aria-label="Buscar município"
          autoComplete="off"
          disabled={!map}
        />
        <div className="absolute right-2 flex items-center">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              onClick={clearQuery}
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {open && (results.length > 0 || error || (query.trim().length >= 2 && !loading)) ? (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-auto rounded-xl border bg-card shadow-lg py-1">
          {error ? (
            <li className="px-3 py-2 text-xs text-destructive">{error}</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">Nenhum município encontrado</li>
          ) : (
            results.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/80 transition-colors"
                  onClick={() => handleSelect(place)}
                >
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  <span className="leading-snug">{place.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
