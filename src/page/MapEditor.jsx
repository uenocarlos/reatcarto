import React, { lazy, Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Geolocation } from '@capacitor/geolocation';

import LeafletMap from '@/components/map/LeafletMap';
import MapToolbar from '@/components/map/MapToolbar';
import StylePanel from '@/components/map/StylePanel';
import ElementContextMenu from '@/components/map/ElementContextMenu';
import GpsTracker from '@/components/map/GpsTracker';
import CitySearchControl from '@/components/map/CitySearchControl';
import LocateMapButton from '@/components/map/LocateMapButton';
import { useAuth } from '@/lib/AuthContext';
import { loadMunicipalitySearchIndex } from '@/lib/geocodeCities';
import {
  createCategoryFromLabel,
  loadLocalElementCategories,
  mergeElementCategories,
  saveLocalElementCategories,
} from '@/lib/elementCategoryStore';
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
import GisExportEntry from '@/components/map/gis/GisExportEntry';
import MobileEditorActionsMenu from '@/components/map/MobileEditorActionsMenu';
import MobileGeometryEditBar from '@/components/map/MobileGeometryEditBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { lockScreenOrientation, unlockScreenOrientation } from '@/lib/deviceViewport';
import { createEditorExportSnapshot } from '@/lib/export/session';
import {
  resolveInitialMapView,
  writeWorkingViewport,
  writeMunicipioLabel,
  readMunicipioLabel,
  viewsAlmostEqual,
} from '@/lib/mapViewport';
import { getOfflineUserId, storeForUser } from '@/lib/offline/offlineApi';

const ExportMapShell = lazy(() => import('@/components/map/ExportMapShell'));
const MemorialDialog = lazy(() => import('@/components/map/MemorialDialog'));
const GisExportDialog = lazy(() => import('@/components/map/gis/GisExportDialog'));

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
  const [memorialOpen, setMemorialOpen] = useState(false);
  const [gisExportOpen, setGisExportOpen] = useState(false);
  const [geometryEditMode, setGeometryEditMode] = useState(false);
  const geometryBaselineRef = useRef(null);
  const isMobile = useIsMobile();
  const historySilentRef = useRef(false);
  const skipOpenEditorRef = useRef(false);
  const pendingHistoryRef = useRef(null);
  /** Snapshot do elemento no momento em que a edição abriu (antes de preview/geometria). */
  const editingBaselineRef = useRef(null);
  const elementsRef = useRef([]);
  const historyRef = useRef(history);
  const historyBusyRef = useRef(false);
  const mapVersionRef = useRef(null);
  const savedViewRef = useRef(null);
  const pendingViewRef = useRef(null);
  const viewSaveTimerRef = useRef(null);
  const viewSaveInFlightRef = useRef(false);
  const suppressViewPersistenceRef = useRef(0);
  const userInteractedRef = useRef(false);
  const { getSyncEngine, isAuthenticated, user, refreshUser } = useAuth();

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
    userInteractedRef.current = false;
    suppressViewPersistenceRef.current = 0;
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
    if (!mapData) return;
    mapVersionRef.current = mapData.version;
    const resolved = resolveInitialMapView(mapId, mapData);
    savedViewRef.current = {
      lat: resolved.lat,
      lng: resolved.lng,
      zoom: resolved.zoom,
    };
  }, [mapId, mapData?.id, mapData?.version, mapData?.center_lat, mapData?.center_lng, mapData?.zoom, mapData?.updated_at]);

  // Pré-carrega índice local de municípios (busca do header)
  useEffect(() => {
    if (!mapData) return undefined;
    const controller = new AbortController();
    void loadMunicipalitySearchIndex({ signal: controller.signal }).catch(() => {});
    return () => controller.abort();
  }, [mapData?.id]);

  useEffect(() => {
    if (!isMobile) return undefined;
    lockScreenOrientation('portrait-primary');
    return () => unlockScreenOrientation();
  }, [isMobile]);

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
    setGeometryEditMode(false);
    geometryBaselineRef.current = null;
    setEditingElement(contextElement);
    setContextMenu(null);
    if (!isMobile) {
      const type = contextElement?.element_type;
      if (type === 'point') {
        toast.info('Arraste o ponto no mapa para reposicionar. Salve no painel.');
      } else if (type === 'line' || type === 'polygon') {
        toast.info('Arraste os vértices ou os pontos intermediários (tracejados) para ajustar a geometria. Salve no painel.');
      }
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
    skipOpenEditorRef.current = true;
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
    geometryBaselineRef.current = null;
    setGeometryEditMode(false);
    queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
    setEditingElement(null);
  };

  const handleStartGeometryEdit = useCallback(() => {
    if (!editingElement) return;
    geometryBaselineRef.current = editingElement.geojson;
    setGeometryEditMode(true);
  }, [editingElement]);

  const handleCancelGeometryEdit = useCallback(() => {
    if (geometryBaselineRef.current != null && editingElement) {
      const geojson = geometryBaselineRef.current;
      setEditingElement((prev) => (prev ? { ...prev, geojson } : null));
      queryClient.setQueryData(['elements', mapId], (old = []) =>
        old.map((el) =>
          String(el.id) === String(editingElement.id) ? { ...el, geojson } : el
        )
      );
    }
    geometryBaselineRef.current = null;
    setGeometryEditMode(false);
  }, [editingElement, mapId, queryClient]);

  const handleFinishGeometryEdit = useCallback(() => {
    geometryBaselineRef.current = null;
    setGeometryEditMode(false);
  }, []);

  const viewsAlmostEqualStable = useCallback(viewsAlmostEqual, []);

  const persistViewportLocally = useCallback(
    (view) => {
      if (!mapId || !view) return;
      writeWorkingViewport(mapId, view);
      if (!getOfflineUserId()) return;
      try {
        void storeForUser().upsertPreparedMap({
          id: mapId,
          center_lat: view.lat,
          center_lng: view.lng,
          zoom: view.zoom,
        });
      } catch {
        /* offline store indisponível */
      }
    },
    [mapId]
  );

  const persistMapView = useCallback(
    async (view, { force = false } = {}) => {
      if (!mapId || !view) return;
      const next = {
        lat: Number(view.lat),
        lng: Number(view.lng),
        zoom: Math.round(Number(view.zoom)),
      };
      if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng) || !Number.isFinite(next.zoom)) {
        return;
      }
      persistViewportLocally(next);
      if (!isOnline()) return;
      if (!force && viewsAlmostEqualStable(savedViewRef.current, next)) {
        pendingViewRef.current = null;
        return;
      }
      if (viewSaveInFlightRef.current) {
        pendingViewRef.current = next;
        return;
      }

      viewSaveInFlightRef.current = true;
      pendingViewRef.current = null;
      try {
        const updated = await api.entities.Map.update(mapId, {
          center_lat: next.lat,
          center_lng: next.lng,
          zoom: next.zoom,
          base_version: mapVersionRef.current,
        });
        mapVersionRef.current = updated.version;
        savedViewRef.current = {
          lat: Number(updated.center_lat),
          lng: Number(updated.center_lng),
          zoom: Number(updated.zoom),
        };
        queryClient.setQueryData(['map', mapId], (old) => {
          if (Array.isArray(old)) {
            return old.map((m) => (String(m.id) === String(mapId) ? { ...m, ...updated } : m));
          }
          return [{ ...updated }];
        });
      } catch (err) {
        // Conflito de versão: recarrega metadados e tenta de novo uma vez
        const code = err?.code;
        if (code === 'conflict' || err?.status === 409) {
          try {
            const fresh = await api.entities.Map.filter({ id: mapId });
            const map = fresh?.[0];
            if (map) {
              mapVersionRef.current = map.version;
              queryClient.setQueryData(['map', mapId], fresh);
              const retried = await api.entities.Map.update(mapId, {
                center_lat: next.lat,
                center_lng: next.lng,
                zoom: next.zoom,
                base_version: map.version,
              });
              mapVersionRef.current = retried.version;
              savedViewRef.current = {
                lat: Number(retried.center_lat),
                lng: Number(retried.center_lng),
                zoom: Number(retried.zoom),
              };
              queryClient.setQueryData(['map', mapId], [retried]);
            }
          } catch {
            /* silencioso — próxima interação tenta de novo */
          }
        }
      } finally {
        viewSaveInFlightRef.current = false;
        if (pendingViewRef.current) {
          const queued = pendingViewRef.current;
          pendingViewRef.current = null;
          void persistMapView(queued);
        }
      }
    },
    [mapId, queryClient, viewsAlmostEqualStable, persistViewportLocally]
  );

  const flushPendingMapView = useCallback(() => {
    if (viewSaveTimerRef.current) {
      clearTimeout(viewSaveTimerRef.current);
      viewSaveTimerRef.current = null;
    }
    const pending = pendingViewRef.current;
    if (!pending) return;
    persistViewportLocally(pending);
    if (isOnline()) {
      void persistMapView(pending, { force: true });
    }
  }, [persistMapView, persistViewportLocally]);

  const handleMapViewChange = useCallback(
    (view) => {
      const next = {
        lat: Number(view.lat),
        lng: Number(view.lng),
        zoom: Math.round(Number(view.zoom)),
      };
      pendingViewRef.current = next;
      persistViewportLocally(next);
      if (viewSaveTimerRef.current) clearTimeout(viewSaveTimerRef.current);
      viewSaveTimerRef.current = setTimeout(() => {
        const pending = pendingViewRef.current;
        if (pending) void persistMapView(pending);
      }, 700);
    },
    [persistMapView, persistViewportLocally]
  );

  const handleMunicipioSelect = useCallback(
    (place) => {
      if (!mapId || !place?.label) return;
      writeMunicipioLabel(mapId, place.label);
    },
    [mapId]
  );

  const beginSuppressViewPersistence = useCallback(() => {
    suppressViewPersistenceRef.current += 1;
  }, []);

  const endSuppressViewPersistence = useCallback(() => {
    suppressViewPersistenceRef.current = Math.max(0, suppressViewPersistenceRef.current - 1);
  }, []);

  // Flush da vista ao sair do editor / trocar de mapa / fechar aba
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushPendingMapView();
    };
    window.addEventListener('pagehide', flushPendingMapView);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushPendingMapView);
      document.removeEventListener('visibilitychange', onHide);
      flushPendingMapView();
    };
  }, [mapId, flushPendingMapView]);

  const initialMapView = useMemo(
    () => (mapData ? resolveInitialMapView(mapId, mapData) : null),
    [mapId, mapData?.id, mapData?.center_lat, mapData?.center_lng, mapData?.zoom, mapData?.updated_at]
  );

  const center = initialMapView ? [initialMapView.lat, initialMapView.lng] : [-32.035, -52.1];
  const zoom = initialMapView?.zoom ?? 13;
  const municipioLabel = initialMapView?.municipioLabel ?? readMunicipioLabel(mapId) ?? '';

  const elementCategories = useMemo(
    () => mergeElementCategories(user?.element_categories ?? [], user?.id, elements),
    [user?.element_categories, user?.id, elements],
  );

  const handleAddElementCategory = useCallback(async (label) => {
    const trimmed = String(label ?? '').trim();
    if (!trimmed) {
      throw new Error('Informe um nome para o tipo');
    }

    const existing = elementCategories.find(
      (category) => category.label.localeCompare(trimmed, 'pt-BR', { sensitivity: 'accent' }) === 0,
    );
    if (existing) return existing;

    const draft = createCategoryFromLabel(trimmed, elementCategories);
    const local = loadLocalElementCategories(user?.id);
    saveLocalElementCategories(user?.id, [...local, draft]);

    if (isOnline()) {
      try {
        const saved = await api.auth.addElementCategory(trimmed);
        const normalized = saved?.id
          ? { id: saved.id, label: saved.label || trimmed, builtin: false }
          : draft;
        const nextLocal = loadLocalElementCategories(user?.id).filter((category) => category.id !== draft.id);
        saveLocalElementCategories(user?.id, nextLocal);
        if (refreshUser) await refreshUser();
        return normalized;
      } catch (error) {
        if (refreshUser) await refreshUser();
        return draft;
      }
    }

    return draft;
  }, [elementCategories, refreshUser, user?.id]);

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
      elementCategories,
    });
  }, [mapInstance, mapData?.name, center, zoom, hiddenIds, basemap, elements, elementCategories]);

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

  const geometryEditingActive = !!editingElement && (!isMobile || geometryEditMode);
  const showMobileGeometryBar = isMobile && geometryEditMode && !!editingElement;
  const showStylePanel = !!editingElement && (!isMobile || !geometryEditMode);

  const citySearchControl = mapData && !exportOpen ? (
    <CitySearchControl
      map={mapInstance}
      enabled
      className="w-full"
      initialMunicipioLabel={municipioLabel}
      onMunicipioSelect={handleMunicipioSelect}
      onSuppressViewPersistenceStart={beginSuppressViewPersistence}
      onSuppressViewPersistenceEnd={endSuppressViewPersistence}
    />
  ) : null;

  const locateControl = mapData && !exportOpen ? (
    <LocateMapButton
      map={mapInstance}
      variant="header"
      userInteractedRef={userInteractedRef}
      onLocated={handleMapViewChange}
    />
  ) : null;

  const mobileActionsMenu = mapData ? (
    <MobileEditorActionsMenu
      onExport={handleOpenExport}
      onMemorial={() => setMemorialOpen(true)}
      onGisExport={() => setGisExportOpen(true)}
      exportDisabled={!isAuthenticated || mapAuthError}
      exportDisabledReason={!isAuthenticated ? 'Faça login para exportar' : undefined}
      gisExportDisabled={!isAuthenticated || mapAuthError}
      gisExportDisabledReason={!isAuthenticated ? 'Faça login para exportar dados GIS' : undefined}
    />
  ) : null;

  const desktopActions = mapData ? (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setMemorialOpen(true)}
        title="Gerar memorial descritivo"
      >
        <FileText className="w-4 h-4" />
        Memorial
      </Button>
      <GisExportEntry
        onOpen={() => setGisExportOpen(true)}
        disabled={!isAuthenticated || mapAuthError}
        disabledReason={!isAuthenticated ? 'Faça login para exportar dados GIS' : undefined}
      />
      <ExportEntry
        onOpen={handleOpenExport}
        disabled={!isAuthenticated || mapAuthError}
        disabledReason={!isAuthenticated ? 'Faça login para exportar' : undefined}
      />
    </>
  ) : null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden overscroll-none">
      {/* Header mobile */}
      {!showMobileGeometryBar ? (
        <div className="md:hidden bg-card border-b px-4 py-3 shadow-sm z-10 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-sm leading-none flex items-center gap-2 truncate">
              {mapData?.name || 'Carregando...'}
              {pendingCount > 0 && <Badge variant="secondary">{pendingCount}</Badge>}
              {!isOnline() && <Badge variant="outline">Offline</Badge>}
            </h1>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold truncate">
              Gerador de Mapas
            </p>
          </div>
          {mobileActionsMenu}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">{citySearchControl}</div>
          {locateControl}
        </div>
        </div>
      ) : null}

      {/* Header desktop */}
      <div className="hidden md:grid grid-cols-[1fr_minmax(14rem,32rem)_1fr] items-center gap-3 bg-card border-b px-4 py-3 shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img
            src="/logo.png"
            alt="Logo"
            className="w-8 h-8 object-contain shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-none flex items-center gap-2 truncate">
              {mapData?.name || 'Carregando...'}
              {pendingCount > 0 && <Badge variant="secondary">{pendingCount} pendente(s)</Badge>}
              {!isOnline() && <Badge variant="outline">Offline</Badge>}
            </h1>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">Gerador de Mapas</p>
          </div>
        </div>

        <div className="flex justify-center items-center gap-2 min-w-0">
          <div className="flex-1 min-w-0 max-w-md">{citySearchControl}</div>
          {locateControl}
        </div>

        <div className="flex items-center justify-end gap-2 min-w-0">
          {desktopActions}
        </div>
      </div>

      {/* Toolbar */}
      {!exportOpen && !showMobileGeometryBar ? (
        <MapToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onDrawingMode={setDrawingMode}
          disabled={isEditingNew}
        />
      ) : null}

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
      {editingElement && !drawingMode && !isMobile ? (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-card border px-4 py-1.5 rounded-full text-xs font-medium shadow-lg">
          {editingElement.element_type === 'point'
            ? 'Arraste o ponto para reposicionar · Salve no painel'
            : 'Arraste os vértices ou os pontos intermediários · Salve no painel'}
        </div>
      ) : null}
      {pasteEnabled && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-medium shadow-lg">
          Clique no mapa para colar o ponto copiado
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {mapData ? (
          <LeafletMap
            mapKey={mapId}
            center={center}
            zoom={zoom}
            initialView={initialMapView}
            suppressViewPersistenceRef={suppressViewPersistenceRef}
            userInteractedRef={userInteractedRef}
            elements={elements}
            otherElements={otherElements}
            showOtherElements={showOtherElements}
            activeTool={activeTool}
            drawingMode={drawingMode}
            onNewElement={handleNewElement}
            onElementLongPress={handleElementLongPress}
            gpsPoints={gpsPoints}
            onMapInstance={setMapInstance}
            editingElementId={geometryEditingActive ? editingElement?.id ?? null : null}
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
            onViewChange={handleMapViewChange}
            showDecorativeBorder
            showLocateControl={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Carregando mapa...
          </div>
        )}
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

      {memorialOpen ? (
        <Suspense fallback={null}>
          <MemorialDialog
            open={memorialOpen}
            onOpenChange={setMemorialOpen}
            elements={elements}
            mapName={mapData?.name ?? ''}
          />
        </Suspense>
      ) : null}

      {gisExportOpen ? (
        <Suspense fallback={null}>
          <GisExportDialog
            open={gisExportOpen}
            onOpenChange={setGisExportOpen}
            mapId={mapId}
            mapName={mapData?.name ?? ''}
            elements={elements}
            hiddenIds={hiddenIds}
            pendingCount={pendingCount}
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
      {showStylePanel ? (
        <StylePanel
          element={editingElement}
          elementCategories={elementCategories}
          onAddCategory={handleAddElementCategory}
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
          isMobile={isMobile}
          onStartGeometryEdit={handleStartGeometryEdit}
        />
      ) : null}

      {showMobileGeometryBar ? (
        <MobileGeometryEditBar
          elementType={editingElement.element_type}
          onCancel={handleCancelGeometryEdit}
          onFinish={handleFinishGeometryEdit}
        />
      ) : null}

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
