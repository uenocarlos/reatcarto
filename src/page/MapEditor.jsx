import React, { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Geolocation } from '@capacitor/geolocation';

import LeafletMap from '@/components/map/LeafletMap';
import MapToolbar from '@/components/map/MapToolbar';
import StylePanel from '@/components/map/StylePanel';
import ElementContextMenu from '@/components/map/ElementContextMenu';
import GpsTracker from '@/components/map/GpsTracker';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import ConflictResolutionModal from '@/components/map/ConflictResolutionModal';
import { isOnline } from '@/lib/offline/connectivity';
import { getOutboxSummary } from '@/lib/offline/offlineApi';
import {
  createEmptyHistory,
  pushHistoryEntry,
  popUndo,
  popRedo,
  snapshotElement,
  snapshotsContentEqual,
  createPayloadFromSnapshot,
  updatePayloadFromSnapshot,
} from '@/lib/elementHistory';
import ExportEntry from '@/components/map/ExportEntry';
import { createEditorExportSnapshot } from '@/lib/export/session';

const ExportMapShell = lazy(() => import('@/components/map/ExportMapShell'));

export default function MapEditor() {
  const { mapId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTool, setActiveTool] = useState('select');
  const [drawingMode, setDrawingMode] = useState(null);
  const [editingElement, setEditingElement] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [contextElement, setContextElement] = useState(null);
  const [copiedStyle, setCopiedStyle] = useState(null);
  const [copiedElement, setCopiedElement] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [showGpsTracker, setShowGpsTracker] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeConflict, setActiveConflict] = useState(null);
  const [history, setHistory] = useState(createEmptyHistory);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [basemap, setBasemap] = useState('branco');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSessionKey, setExportSessionKey] = useState(0);
  const [exportSnapshot, setExportSnapshot] = useState(null);
  const historySilentRef = useRef(false);
  const skipOpenEditorRef = useRef(false);
  const pendingHistoryRef = useRef(null);
  /** Snapshot do elemento no momento em que a edição abriu (antes de preview/geometria). */
  const editingBaselineRef = useRef(null);
  const elementsRef = useRef([]);
  const historyRef = useRef(history);
  const historyBusyRef = useRef(false);
  const { getSyncEngine, isAuthenticated } = useAuth();

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Histórico é por sessão de mapa (não persiste entre mapas)
  useEffect(() => {
    const empty = createEmptyHistory();
    historyRef.current = empty;
    setHistory(empty);
    editingBaselineRef.current = null;
    pendingHistoryRef.current = null;
  }, [mapId]);

  const refreshPending = useCallback(async () => {
    try {
      const summary = await getOutboxSummary();
      setPendingCount(summary.pending + summary.conflicted);
      const engine = getSyncEngine?.();
      if (engine) {
        const conflicts = await engine.store.getConflicts();
        if (conflicts.length > 0) setActiveConflict(conflicts[0]);
      }
    } catch {
      /* offline user not set yet */
    }
  }, [getSyncEngine]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const { data: mapData, isError: mapAuthError } = useQuery({
    queryKey: ['map', mapId],
    queryFn: () => api.entities.Map.filter({ id: mapId }),
    select: (data) => data[0],
    retry: false,
  });

  const { data: elements = [] } = useQuery({
    queryKey: ['elements', mapId],
    queryFn: () => api.entities.MapElement.filter({ map_id: mapId }),
  });

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const commitHistory = useCallback((entry) => {
    if (historySilentRef.current || !entry) return;
    setHistory((prev) => {
      const next = pushHistoryEntry(prev, entry);
      historyRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (mapAuthError) {
      toast.error('Mapa não encontrado, acesso negado ou indisponível offline');
      navigate('/');
    }
  }, [mapAuthError, navigate]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending, elements.length]);

  const { data: otherElements = [] } = useQuery({
    queryKey: ['other-elements', mapId],
    queryFn: async () => {
      const maps = await api.entities.Map.list('-created_date');
      const others = maps.filter((m) => String(m.id) !== String(mapId));
      const lists = await Promise.all(
        others.map((m) => api.entities.MapElement.filter({ map_id: m.id }))
      );
      return lists.flat();
    },
    enabled: !!mapId,
  });

  const [showOtherElements, setShowOtherElements] = useState(false);

  // Lock drawing if we are currently editing a new element
  const isEditingNew = !!editingElement && editingElement._isNew;

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.MapElement.create(data),
    onSuccess: (newEl) => {
      queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
      if (!historySilentRef.current) {
        commitHistory({ type: 'create', element: snapshotElement(newEl) });
      }
      if (skipOpenEditorRef.current) {
        skipOpenEditorRef.current = false;
        editingBaselineRef.current = null;
      } else if (!historySilentRef.current) {
        const snap = snapshotElement(newEl);
        editingBaselineRef.current = snap;
        setEditingElement({ ...newEl, _isNew: true });
      }
    },
    onError: (err) => {
      skipOpenEditorRef.current = false;
      toast.error(err.message || 'Falha ao criar elemento');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const { base_version, ...rest } = data;
      const current = elementsRef.current.find((e) => String(e.id) === String(id));
      return api.entities.MapElement.update(id, {
        ...rest,
        base_version: base_version ?? current?.version ?? editingElement?.version,
      });
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
      if (!historySilentRef.current && pendingHistoryRef.current?.type === 'update') {
        commitHistory(pendingHistoryRef.current);
      }
      pendingHistoryRef.current = null;
      editingBaselineRef.current = null;
      if (!historySilentRef.current) {
        setEditingElement(null);
        if (!variables?._silentToast) {
          toast.success('Elemento salvo!');
        }
      }
    },
    onError: (err) => {
      pendingHistoryRef.current = null;
      toast.error(err.message || 'Falha ao salvar elemento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }) => {
      const el = elementsRef.current.find((e) => String(e.id) === String(id));
      return api.entities.MapElement.delete(id, version ?? el?.version);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
      if (!historySilentRef.current && pendingHistoryRef.current?.type === 'delete') {
        commitHistory(pendingHistoryRef.current);
      } else if (!historySilentRef.current && variables?.elementSnapshot) {
        commitHistory({ type: 'delete', element: variables.elementSnapshot });
      }
      pendingHistoryRef.current = null;
      if (!historySilentRef.current && !variables?._silentToast) {
        toast.success('Elemento excluído!');
      }
      setEditingElement((prev) =>
        prev && String(prev.id) === String(variables?.id) ? null : prev
      );
    },
    onError: (err) => {
      pendingHistoryRef.current = null;
      toast.error(err.message || 'Falha ao excluir elemento');
    },
  });

  const findElementVersion = useCallback((id) => {
    const el = elementsRef.current.find((e) => String(e.id) === String(id));
    return el?.version;
  }, []);

  const applyHistoryEntry = useCallback(
    async (entry, direction) => {
      if (!entry || historyBusyRef.current) return false;
      historyBusyRef.current = true;
      setHistoryBusy(true);
      historySilentRef.current = true;
      skipOpenEditorRef.current = true;
      editingBaselineRef.current = null;
      try {
        const invert = direction === 'undo';
        if (entry.type === 'create') {
          if (invert) {
            const id = entry.element.id;
            await api.entities.MapElement.delete(id, findElementVersion(id) ?? entry.element.version);
          } else {
            const created = await api.entities.MapElement.create(
              createPayloadFromSnapshot(entry.element)
            );
            entry.element = snapshotElement(created);
          }
        } else if (entry.type === 'delete') {
          if (invert) {
            const created = await api.entities.MapElement.create(
              createPayloadFromSnapshot(entry.element)
            );
            entry.element = snapshotElement(created);
          } else {
            const id = entry.element.id;
            await api.entities.MapElement.delete(id, findElementVersion(id) ?? entry.element.version);
          }
        } else if (entry.type === 'update') {
          const snap = invert ? entry.before : entry.after;
          if (!snap) {
            toast.error('Histórico incompleto para esta ação');
            return false;
          }
          const id = entry.id ?? snap.id;
          const current = elementsRef.current.find((e) => String(e.id) === String(id));
          if (!current) {
            toast.error('Elemento não encontrado para desfazer/refazer');
            return false;
          }
          await api.entities.MapElement.update(id, {
            ...updatePayloadFromSnapshot(snap),
            base_version: current.version,
          });
          entry.id = id;
        }
        await queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
        setEditingElement(null);
        return true;
      } catch (err) {
        toast.error(err.message || 'Não foi possível desfazer/refazer');
        return false;
      } finally {
        historySilentRef.current = false;
        skipOpenEditorRef.current = false;
        historyBusyRef.current = false;
        setHistoryBusy(false);
      }
    },
    [findElementVersion, mapId, queryClient]
  );

  const handleUndo = useCallback(async () => {
    if (historyBusyRef.current) return;
    const current = historyRef.current;
    if (!current.undo.length) return;
    const { entry, history: next } = popUndo(current);
    const ok = await applyHistoryEntry(entry, 'undo');
    if (ok) {
      historyRef.current = next;
      setHistory(next);
    }
  }, [applyHistoryEntry]);

  const handleRedo = useCallback(async () => {
    if (historyBusyRef.current) return;
    const current = historyRef.current;
    if (!current.redo.length) return;
    const { entry, history: next } = popRedo(current);
    const ok = await applyHistoryEntry(entry, 'redo');
    if (ok) {
      historyRef.current = next;
      setHistory(next);
    }
  }, [applyHistoryEntry]);

  // Handle new element creation from map
  const handleNewElement = useCallback((type, geojson) => {
    if (isEditingNew) {
      toast.error('Salve ou cancele o elemento atual antes de criar um novo');
      return;
    }

    createMutation.mutate({
      map_id: mapId,
      element_type: type,
      geojson: geojson,
      name: '',
      description: '',
      element_category: 'terra',
      is_publicly_visible: true,
      style: JSON.stringify(type === 'point' ? { icon_name: 'pin', icon_color: '#F97316' } : type === 'line' ? { color: '#F97316', opacity: 100, weight: 3, dash_style: 'solid' } : { border_color: '#F97316', border_opacity: 100, border_weight: 2, border_dash: 'solid', fill_color: '#FED7AA', fill_opacity: 40 }),
    });
    setActiveTool('select');
    setDrawingMode(null);
  }, [mapId, createMutation, isEditingNew]);

  // GPS point insertion
  useEffect(() => {
    let active = true;
    const getGpsPoint = async () => {
      if (activeTool === 'point' && drawingMode === 'gps') {
        const toastId = toast.loading('Obtendo localização GPS...');
        
        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000
          });

          if (active) {
            const geojson = { type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude] };
            handleNewElement('point', JSON.stringify(geojson));
            toast.dismiss(toastId);
            toast.success('Ponto capturado via GPS!');
          }
        } catch (e) {
          if (active) {
            console.error('GPS Error:', e);
            toast.dismiss(toastId);
            toast.error('Erro no GPS: ' + (e.message || 'Verifique se o GPS está ligado e se deu permissão.'));
          }
        } finally {
          if (active) {
            setActiveTool('select');
            setDrawingMode(null);
          }
        }
      }
    };
    getGpsPoint();
    return () => { active = false; };
  }, [activeTool, drawingMode, handleNewElement]);

  // GPS tracking mode
  useEffect(() => {
    let watchId = null;

    const startTracking = async () => {
      if ((activeTool === 'line' || activeTool === 'polygon') && drawingMode === 'gps-track') {
        setShowGpsTracker(true);
        setGpsPoints([]);

        try {
          watchId = await Geolocation.watchPosition(
            {
              enableHighAccuracy: true,
              timeout: 5000,
            },
            (position, err) => {
              if (err) {
                console.error('Tracking Error:', err);
                return;
              }
              if (position) {
                const newPoint = [position.coords.latitude, position.coords.longitude];
                setGpsPoints(prev => {
                  // Evita adicionar pontos duplicados muito próximos
                  if (prev.length > 0) {
                    const last = prev[prev.length - 1];
                    const dist = Math.sqrt(Math.pow(last[0] - newPoint[0], 2) + Math.pow(last[1] - newPoint[1], 2));
                    if (dist < 0.00001) return prev; // aprox 1 metro
                  }
                  return [...prev, newPoint];
                });
              }
            }
          );
        } catch (e) {
          console.error('WatchPosition error:', e);
          toast.error('Não foi possível iniciar o rastreamento GPS');
          setActiveTool('select');
          setDrawingMode(null);
        }
      }
    };

    startTracking();

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [activeTool, drawingMode]);

  const handleGpsTrackFinish = (points) => {
    if (points.length < 2) return;
    if (activeTool === 'line') {
      const geojson = { type: 'LineString', coordinates: points.map(p => [p[1], p[0]]) };
      handleNewElement('line', JSON.stringify(geojson));
    } else if (activeTool === 'polygon') {
      // Auto-close if needed
      const first = points[0];
      const last = points[points.length - 1];
      const dist = Math.sqrt(Math.pow(first[0] - last[0], 2) + Math.pow(first[1] - last[1], 2));
      let finalPoints = points;
      if (dist > 0.0001) {
        finalPoints = [...points, first]; // auto-close
      }
      const geojson = { type: 'Polygon', coordinates: [finalPoints.map(p => [p[1], p[0]])] };
      handleNewElement('polygon', JSON.stringify(geojson));
    }
    setActiveTool('select');
    setDrawingMode(null);
    setGpsPoints([]);
  };

  // Context menu handlers
  const handleElementLongPress = (el, pos) => {
    setContextElement(el);
    setContextMenu(pos);
  };

  const handleEdit = () => {
    if (!contextElement) return;
    // Captura estado original ANTES de preview de estilo / arrasto de vértices
    editingBaselineRef.current = snapshotElement(contextElement);
    setEditingElement(contextElement);
    setContextMenu(null);
    const type = contextElement?.element_type;
    if (type === 'point') {
      toast.info('Arraste o ponto no mapa para reposicionar. Salve no painel.');
    } else if (type === 'line' || type === 'polygon') {
      toast.info('Arraste os vértices (círculos brancos) para ajustar a geometria. Salve no painel.');
    }
  };

  const handleDelete = () => {
    if (!contextElement) return;
    pendingHistoryRef.current = {
      type: 'delete',
      element: snapshotElement(contextElement),
    };
    deleteMutation.mutate({
      id: contextElement.id,
      version: contextElement.version,
      elementSnapshot: snapshotElement(contextElement),
    });
    setContextMenu(null);
    setContextElement(null);
  };

  const handleCopy = () => {
    if (contextElement?.element_type !== 'point') return;
    setCopiedElement(contextElement);
    setContextMenu(null);
    toast.success('Elemento copiado! Clique no mapa para colar');
  };

  const handlePasteElement = useCallback((coords) => {
    if (!copiedElement || copiedElement.element_type !== 'point') return;
    if (isEditingNew) {
      toast.error('Salve ou cancele o elemento atual antes de colar');
      return;
    }
    const geojson = { type: 'Point', coordinates: [coords[1], coords[0]] };
    const style =
      typeof copiedElement.style === 'string'
        ? copiedElement.style
        : JSON.stringify(copiedElement.style ?? {});
    createMutation.mutate({
      map_id: mapId,
      element_type: 'point',
      geojson: JSON.stringify(geojson),
      name: copiedElement.name || '',
      description: copiedElement.description || '',
      element_category: copiedElement.element_category || 'terra',
      style,
      is_publicly_visible:
        copiedElement.is_publicly_visible !== false && copiedElement.is_publicly_visible !== 0,
    });
    setCopiedElement(null);
    toast.success('Ponto colado!');
  }, [copiedElement, isEditingNew, mapId, createMutation]);

  const handleGeometryChange = useCallback((geojsonObj) => {
    if (!editingElement) return;
    const geojson = typeof geojsonObj === 'string' ? geojsonObj : JSON.stringify(geojsonObj);
    setEditingElement((prev) => (prev ? { ...prev, geojson } : null));
    queryClient.setQueryData(['elements', mapId], (old = []) =>
      old.map((el) =>
        String(el.id) === String(editingElement.id) ? { ...el, geojson } : el
      )
    );
  }, [editingElement, mapId, queryClient]);

  const handleCopyStyle = () => {
    if (!contextElement) return;
    const styleStr =
      typeof contextElement.style === 'string'
        ? contextElement.style
        : JSON.stringify(contextElement.style ?? {});
    setCopiedStyle({
      type: contextElement.element_type,
      style: styleStr,
      name: contextElement.name || '',
      description: contextElement.description || '',
      element_category: contextElement.element_category || 'terra',
      is_publicly_visible:
        contextElement.is_publicly_visible !== false && contextElement.is_publicly_visible !== 0,
    });
    setContextMenu(null);
    setContextElement(null);
    toast.success('Formatação copiada! Cole uma vez em outro elemento do mesmo tipo.');
  };

  const handlePasteStyle = () => {
    if (!contextElement || !copiedStyle) return;
    if (copiedStyle.type !== contextElement.element_type) {
      toast.error('Só é possível colar formatação entre elementos do mesmo tipo (ponto/linha/polígono).');
      setContextMenu(null);
      return;
    }
    const styleStr =
      typeof copiedStyle.style === 'string'
        ? copiedStyle.style
        : JSON.stringify(copiedStyle.style ?? {});
    const targetId = contextElement.id;
    const patch = {
      style: styleStr,
      name: copiedStyle.name ?? contextElement.name ?? '',
      description: copiedStyle.description ?? contextElement.description ?? '',
      element_category: copiedStyle.element_category ?? contextElement.element_category ?? 'terra',
      is_publicly_visible:
        copiedStyle.is_publicly_visible !== false && copiedStyle.is_publicly_visible !== 0,
    };

    // Pré-visualização imediata no mapa
    queryClient.setQueryData(['elements', mapId], (old = []) =>
      old.map((el) =>
        String(el.id) === String(targetId) ? { ...el, ...patch } : el
      )
    );

    const before = snapshotElement(contextElement);
    const after = snapshotElement({ ...contextElement, ...patch });
    pendingHistoryRef.current = {
      type: 'update',
      id: targetId,
      before,
      after,
    };
    updateMutation.mutate({
      id: targetId,
      data: {
        ...patch,
        base_version: contextElement.version,
      },
    });
    setCopiedStyle(null);
    setContextMenu(null);
    setContextElement(null);
  };

  // Real-time preview: merge style changes into local elements list instantly
  const handleStylePreview = useCallback((styleData) => {
    queryClient.setQueryData(['elements', mapId], (old = []) =>
      old.map(el => el.id === editingElement?.id ? { ...el, ...styleData } : el)
    );
  }, [editingElement, mapId, queryClient]);

  const handleStyleSave = (data) => {
    if (!editingElement) return;
    // Nunca usar o cache com preview: o "antes" é o estado ao abrir a edição
    const live =
      elementsRef.current.find((e) => String(e.id) === String(editingElement.id)) || editingElement;
    const before =
      editingBaselineRef.current ||
      snapshotElement({
        ...live,
        // sem geojson/style do preview (fallback raro se baseline sumiu)
        geojson: live.geojson,
        style: live.style,
      });

    const after = snapshotElement({
      ...before,
      ...data,
      id: editingElement.id,
      map_id: editingElement.map_id ?? before.map_id,
      element_type: editingElement.element_type ?? before.element_type,
      geojson: editingElement.geojson,
      version: editingElement.version ?? before.version,
      style:
        typeof data.style === 'string'
          ? data.style
          : data.style != null
            ? JSON.stringify(data.style)
            : before.style,
    });

    if (snapshotsContentEqual(before, after)) {
      pendingHistoryRef.current = null;
    } else {
      pendingHistoryRef.current = {
        type: 'update',
        id: editingElement.id,
        before,
        after,
      };
    }
    updateMutation.mutate({
      id: editingElement.id,
      data: {
        ...data,
        geojson: editingElement.geojson,
      },
    });
  };

  const handleStyleClose = () => {
    // Descarta geometria / estilo pré-visualizado sem salvar
    editingBaselineRef.current = null;
    queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
    setEditingElement(null);
  };

  const center = mapData ? [mapData.center_lat || -32.035, mapData.center_lng || -52.1] : [-32.035, -52.1];
  const zoom = mapData?.zoom || 13;

  const buildExportSnapshot = useCallback(() => {
    const mapCenter = mapInstance?.getCenter?.();
    const mapZoom = mapInstance?.getZoom?.();
    return createEditorExportSnapshot({
      mapName: mapData?.name ?? '',
      center: mapCenter
        ? { lat: mapCenter.lat, lng: mapCenter.lng }
        : { lat: center[0], lng: center[1] },
      zoom: Number.isFinite(mapZoom) ? mapZoom : zoom,
      hiddenIds,
      basemap,
      elements,
    });
  }, [mapInstance, mapData?.name, center, zoom, hiddenIds, basemap, elements]);

  const handleOpenExport = useCallback(() => {
    if (exportOpen) return;
    if (!isAuthenticated || mapAuthError) {
      toast.error('Sessão expirada. Faça login novamente para exportar.');
      return;
    }
    if (!mapData) return;
    setExportSnapshot(buildExportSnapshot());
    setExportSessionKey((key) => key + 1);
    setExportOpen(true);
  }, [exportOpen, isAuthenticated, mapAuthError, mapData, buildExportSnapshot]);

  const pasteEnabled =
    !!copiedElement &&
    copiedElement.element_type === 'point' &&
    activeTool === 'select' &&
    !drawingMode &&
    !editingElement;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden overscroll-none">
      {/* Header */}
      <div className="bg-card border-b px-4 py-3 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="w-8 h-8 object-contain"
          />
          <div>
            <h1 className="font-bold text-base leading-none flex items-center gap-2">
              {mapData?.name || 'Carregando...'}
              {pendingCount > 0 && <Badge variant="secondary">{pendingCount} pendente(s)</Badge>}
              {!isOnline() && <Badge variant="outline">Offline</Badge>}
            </h1>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">Gerador de Mapas</p>
          </div>
        </div>
        {mapData ? (
          <ExportEntry
            onOpen={handleOpenExport}
            disabled={!isAuthenticated || mapAuthError}
            disabledReason={!isAuthenticated ? 'Faça login para exportar' : undefined}
          />
        ) : null}
      </div>

      {/* Toolbar */}
      <MapToolbar 
        activeTool={activeTool} 
        onToolChange={setActiveTool} 
        onDrawingMode={setDrawingMode} 
        disabled={isEditingNew}
      />

      {/* Drawing mode indicator */}
      {drawingMode && activeTool !== 'select' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-medium shadow-lg">
          {drawingMode === 'manual' && 'Clique no mapa para inserir o ponto'}
          {drawingMode === 'gps' && 'Obtendo localização...'}
          {drawingMode === 'freehand' && 'Desenhe com o dedo ou mouse'}
          {drawingMode === 'point-by-point' && 'Clique para adicionar pontos'}
          {drawingMode === 'gps-track' && 'Rastreamento GPS ativo'}
        </div>
      )}
      {editingElement && !drawingMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-card border px-4 py-1.5 rounded-full text-xs font-medium shadow-lg">
          {editingElement.element_type === 'point'
            ? 'Arraste o ponto para reposicionar · Salve no painel'
            : 'Arraste os vértices para ajustar a geometria · Salve no painel'}
        </div>
      )}
      {pasteEnabled && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-medium shadow-lg">
          Clique no mapa para colar o ponto copiado
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <LeafletMap
          center={center}
          zoom={zoom}
          elements={elements}
          otherElements={otherElements}
          showOtherElements={showOtherElements}
          activeTool={activeTool}
          drawingMode={drawingMode}
          onNewElement={handleNewElement}
          onElementLongPress={handleElementLongPress}
          gpsPoints={gpsPoints}
          onMapInstance={setMapInstance}
          editingElementId={editingElement?.id ?? null}
          onGeometryChange={handleGeometryChange}
          pasteEnabled={pasteEnabled}
          onPasteAt={handlePasteElement}
          canUndo={!historyBusy && history.undo.length > 0}
          canRedo={!historyBusy && history.redo.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          hiddenIds={hiddenIds}
          onHiddenIdsChange={setHiddenIds}
          basemap={basemap}
          onBasemapChange={setBasemap}
        />
      </div>

      {exportOpen && exportSnapshot ? (
        <Suspense fallback={null}>
          <ExportMapShell
            key={exportSessionKey}
            open={exportOpen}
            onOpenChange={(open) => {
              setExportOpen(open);
              if (!open) setExportSnapshot(null);
            }}
            snapshot={exportSnapshot}
          />
        </Suspense>
      ) : null}

      {/* GPS Tracker */}
      <GpsTracker
        isActive={showGpsTracker}
        onFinish={handleGpsTrackFinish}
        onCancel={() => { setActiveTool('select'); setDrawingMode(null); }}
      />

      {/* Style Panel */}
      {editingElement && (
        <StylePanel
          element={editingElement}
          onSave={handleStyleSave}
          onDelete={(id) => {
            const el =
              elementsRef.current.find((e) => String(e.id) === String(id)) || editingElement;
            pendingHistoryRef.current = {
              type: 'delete',
              element: snapshotElement(el),
            };
            deleteMutation.mutate({
              id,
              version: el?.version,
              elementSnapshot: snapshotElement(el),
            });
          }}
          onClose={handleStyleClose}
          onPreview={handleStylePreview}
        />
      )}

      {/* Context Menu */}
      <ElementContextMenu
        position={contextMenu}
        elementType={contextElement?.element_type}
        hasCopiedStyle={!!copiedStyle}
        copiedStyleType={copiedStyle?.type}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onCopyStyle={handleCopyStyle}
        onPasteStyle={handlePasteStyle}
        onClose={() => { setContextMenu(null); setContextElement(null); }}
      />

      <ConflictResolutionModal
        conflict={activeConflict}
        open={!!activeConflict}
        onClose={() => setActiveConflict(null)}
        onResolve={async (mutationId, choice, baseVersion) => {
          const engine = getSyncEngine?.();
          if (engine) {
            await engine.resolveConflict(mutationId, choice, baseVersion);
            setActiveConflict(null);
            refreshPending();
            queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
            toast.success('Conflito resolvido');
          }
        }}
      />
    </div>
  );
}
