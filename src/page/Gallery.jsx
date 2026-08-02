import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Search, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { isOnline } from '@/lib/offline/connectivity';

function mergeMaps(existing, incoming) {
  const seen = new Set(existing.map((m) => m.public_id));
  const merged = [...existing];
  for (const map of incoming) {
    if (!seen.has(map.public_id)) {
      seen.add(map.public_id);
      merged.push(map);
    }
  }
  return merged;
}

export default function Gallery() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));
  const [mergedMaps, setMergedMaps] = useState([]);
  const [staleWarning, setStaleWarning] = useState(false);

  const searchTerm = searchParams.get('q') || '';
  const currentPage = Number(searchParams.get('page') || 1);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['public-gallery', searchTerm, currentPage],
    queryFn: () => api.public.listMaps({ q: searchTerm || undefined, page: currentPage }),
    enabled: isOnline(),
    retry: false,
  });

  useEffect(() => {
    if (!isOnline()) {
      setStaleWarning(true);
      return;
    }
    setStaleWarning(false);
    if (data?.maps) {
      setMergedMaps((prev) => (currentPage === 1 ? data.maps : mergeMaps(prev, data.maps)));
    }
  }, [data, currentPage]);

  const handleSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set('q', query.trim());
    next.set('page', '1');
    setPage(1);
    setMergedMaps([]);
    setSearchParams(next);
  };

  const maps = currentPage === 1 ? (data?.maps ?? []) : mergedMaps;
  const pagination = data?.pagination;
  const offline = !isOnline();

  return (
    <div className="min-h-screen bg-background font-inter">
      <div className="bg-primary">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8 text-primary-foreground" />
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground">Galeria Pública</h1>
                <p className="text-primary-foreground/80 text-sm">Mapas publicados pela comunidade</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar mapas por nome ou descrição..."
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={offline || isFetching}>
            Buscar
          </Button>
        </form>

        {offline && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              Você está offline. Resultados anteriores podem estar desatualizados.
              <Button variant="link" className="px-2" onClick={() => refetch()} disabled={offline}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {staleWarning && !offline && isError && (
          <Card className="mb-4 border-destructive/30">
            <CardContent className="py-4 text-sm">
              Não foi possível atualizar a galeria.
              <Button variant="link" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading && !offline ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : maps.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <MapPin className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium">Nenhum mapa encontrado</h3>
              <p className="text-muted-foreground text-sm mt-2">
                {searchTerm ? 'Tente outro termo de busca.' : 'Ainda não há mapas publicados.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {maps.map((map) => (
              <Card
                key={map.public_id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/gallery/${map.public_id}`)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{map.name}</h3>
                      <Badge variant="secondary" className="text-[10px]">Público</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {map.description || 'Sem descrição'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || offline}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(currentPage - 1));
                setSearchParams(next);
              }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {pagination.page} de {pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.total_pages || offline}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(currentPage + 1));
                setSearchParams(next);
              }}
            >
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
