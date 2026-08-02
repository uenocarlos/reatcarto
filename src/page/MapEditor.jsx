import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, Share2, Layers, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

import LeafletMap from '@/components/map/LeafletMap';
import MapToolbar from '@/components/map/MapToolbar';
import StylePanel from '@/components/map/StylePanel';
import ElementContextMenu from '@/components/map/ElementContextMenu';
import GpsTracker from '@/components/map/GpsTracker';
import ExportMapModal from '@/components/map/ExportMapModal';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import ConflictResolutionModal from '@/components/map/ConflictResolutionModal';
import { isOnline } from '@/lib/offline/connectivity';
import { getOutboxSummary } from '@/lib/offline/offlineApi';
import { canOpenExport, isExportEntryReady } from '@/lib/export/exportGates';
import { createExportSettingsStore } from '@/lib/export/exportSettingsStore';
import { defaultExportSettings } from '@/lib/export/exportSettings';
import { createExportController } from '@/lib/export/exportController';
import { ExportCaptureError } from '@/lib/export/pngExporter';

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
  const [showExport, setShowExport] = useState(false);
  const [exportSettings, setExportSettings] = useState(defaultExportSettings());
  const exportSettingsStoreRef = useRef(null);
  const exportModalHydratedRef = useRef(false);
  const exportModalHydratedMapIdRef = useRef(null);
  const exportControllerRef = useRef(null);
  if (!exportControllerRef.current) {
    exportControllerRef.current = createExportController();
  }
  const [isExporting, setIsExporting] = useState(false);
  const [ownershipLost, setOwnershipLost] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [showGpsTracker, setShowGpsTracker] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeConflict, setActiveConflict] = useState(null);
  const { getSyncEngine } = useAuth();

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
    if (mapAuthError) {
      setOwnershipLost(showExport);
      toast.error('Mapa não encontrado, acesso negado ou indisponível offline');
      navigate('/');
    }
  }, [mapAuthError, navigate, showExport]);

  const isOwner = Boolean(mapData && !mapAuthError);
  const mapDataReady = Boolean(mapData);
  const canOpen = canOpenExport({ isOwner, mapId });
  const exportEntryReady = isExportEntryReady({ mapDataReady, mapId });

  useEffect(() => {
    if (!mapId) {
      exportSettingsStoreRef.current = null;
      return;
    }
    exportSettingsStoreRef.current = createExportSettingsStore({
      mapId,
      persist: async (settings) => {
        const updated = await api.entities.Map.update(mapId, { export_settings: settings });
        queryClient.setQueryData(['map', mapId], updated);
        return updated;
      },
    });
  }, [mapId, queryClient]);

  useEffect(() => {
    if (!showExport) {
      exportModalHydratedRef.current = false;
      exportModalHydratedMapIdRef.current = null;
      return;
    }
    if (!mapId || !mapData || !exportSettingsStoreRef.current) return;

    const shouldHydrate =
      !exportModalHydratedRef.current || exportModalHydratedMapIdRef.current !== mapId;
    if (!shouldHydrate) return;

    const hydrated = exportSettingsStoreRef.current.hydrate(
      mapId,
      mapData.export_settings,
      elements
    );
    setExportSettings(hydrated);
    exportModalHydratedRef.current = true;
    exportModalHydratedMapIdRef.current = mapId;
  }, [showExport, mapId, mapData]);

  useEffect(() => {
    if (!showExport || !mapId || !exportSettingsStoreRef.current) return;
    if (!exportModalHydratedRef.current) return;
    if (isExporting) return;

    setExportSettings(exportSettingsStoreRef.current.updateSettings({}, elements));
  }, [showExport, mapId, elements, isExporting]);

  const handleOpenExport = useCallback(() => {
    if (!canOpen || !exportEntryReady) return;
    setShowExport(true);
  }, [canOpen, exportEntryReady]);

  const handleCloseExport = useCallback(async () => {
    exportControllerRef.current?.abortExport();
    try {
      await exportSettingsStoreRef.current?.flush();
    } catch {
      /* session memory retained per ADR-007 */
    }
    setShowExport(false);
    setIsExporting(false);
  }, []);

  const handleExportSettingsChange = useCallback(
    (partial) => {
      if (!exportSettingsStoreRef.current || isExporting) return;
      setExportSettings(exportSettingsStoreRef.current.updateSettings(partial, elements));
    },
    [elements, isExporting]
  );

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
      setEditingElement({ ...newEl, _isNew: true });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) =>
      api.entities.MapElement.update(id, { ...data, base_version: editingElement?.version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
      setEditingElement(null);
      toast.success('Elemento salvo!');
    },
    onError: (err) => {
      toast.error(err.message || 'Falha ao salvar elemento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      const el = elements.find((e) => e.id === id);
      return api.entities.MapElement.delete(id, el?.version);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements', mapId] });
      toast.success('Elemento excluído!');
    },
  });

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
    setEditingElement(contextElement);
    setContextMenu(null);
  };

  const handleDelete = () => {
    deleteMutation.mutate(contextElement.id);
    setContextMenu(null);
    setContextElement(null);
  };

  const handleCopy = () => {
    setCopiedElement(contextElement);
    setContextMenu(null);
    toast.success('Elemento copiado! Clique no mapa para colar');
  };

  const handleCopyStyle = () => {
    setCopiedStyle({ type: contextElement.element_type, style: contextElement.style, icon_name: contextElement.icon_name, icon_color: contextElement.icon_color, custom_icon_url: contextElement.custom_icon_url });
    setContextMenu(null);
    toast.success('Formatação copiada!');
  };

  const handlePasteStyle = () => {
    if (!copiedStyle || copiedStyle.type !== contextElement.element_type) return;
    updateMutation.mutate({
      id: contextElement.id,
      data: { style: copiedStyle.style, icon_name: copiedStyle.icon_name, icon_color: copiedStyle.icon_color, custom_icon_url: copiedStyle.custom_icon_url },
    });
    setContextMenu(null);
    toast.success('Formatação colada!');
  };

  // Real-time preview: merge style changes into local elements list instantly
  const handleStylePreview = useCallback((styleData) => {
    queryClient.setQueryData(['elements', mapId], (old = []) =>
      old.map(el => el.id === editingElement?.id ? { ...el, ...styleData } : el)
    );
  }, [editingElement, mapId, queryClient]);

  const handleStyleSave = (data) => {
    updateMutation.mutate({ id: editingElement.id, data });
  };

  const handleExport = async (config, previewElement) => {
    const controller = exportControllerRef.current;
    if (!controller || controller.getIsExporting()) return;

    if (ownershipLost || !isOwner) {
      toast.error('Você não tem permissão para exportar este mapa.');
      return;
    }

    setIsExporting(true);
    const frozenElements = elements;

    try {
      await exportSettingsStoreRef.current?.flush();
    } catch {
      /* continue with in-memory settings */
    }

    const toastId = toast.loading('Gerando arquivo...');

    const result = await controller.attemptExport({
      settings: config,
      previewEl: previewElement,
      elements: frozenElements,
      canExport: isOwner && !ownershipLost,
      fileBaseName: config.title || 'mapa',
    });

    toast.dismiss(toastId);
    setIsExporting(false);

    if (result.status === 'blocked') {
      return;
    }

    if (result.status === 'rejected') {
      return;
    }

    if (result.status === 'aborted' || result.status === 'cancelled') {
      return;
    }

    if (result.status === 'error') {
      const message =
        result.error instanceof ExportCaptureError
          ? result.error.message
          : 'Falha ao exportar o mapa. Verifique a conexão com as camadas base.';
      toast.error(message);
      return;
    }

    if (result.status === 'success') {
      toast.success('Mapa exportado com sucesso!');
      setShowExport(false);
    }
  };

  const center = mapData ? [mapData.center_lat || -32.035, mapData.center_lng || -52.1] : [-32.035, -52.1];
  const zoom = mapData?.zoom || 13;

  const handleExportGeoJSON = async () => {
    if (elements.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const toastId = toast.loading('Preparando GeoJSON com ícones...');

    try {
      const getBase64Svg = async (iconName, color) => {
        let svgText = '';
        if (iconName && (iconName.startsWith('/') || iconName.startsWith('http') || iconName.endsWith('.svg'))) {
          try {
            const response = await fetch(iconName);
            svgText = await response.text();
            
            // Força a cor no SVG injetando fill e removendo cores fixas
            if (color) {
              // Remove qualquer estilo interno que possa sobrescrever a cor
              svgText = svgText.replace(/<style[\s\S]*?<\/style>/gi, '');
              // Remove fills existentes para forçar o novo
              svgText = svgText.replace(/fill="[^"]*"/g, '');
              // Injeta o novo fill na tag svg
              svgText = svgText.replace('<svg', `<svg fill="${color}"`);
              // Também garante que caminhos (paths) herdem a cor
              svgText = svgText.replace(/<path/g, `<path fill="${color}"`);
            }
          } catch (e) {
            console.error('Error fetching icon', e);
            return null;
          }
        } else {
          const fn = ICON_SVGS[iconName] || ICON_SVGS.pin;
          svgText = fn(color || '#F97316');
        }
        
        // Converte para Base64 com suporte a Unicode
        const base64 = btoa(unescape(encodeURIComponent(svgText)));
        return `data:image/svg+xml;base64,${base64}`;
      };

      const features = await Promise.all(elements.map(async el => {
        const geometry = typeof el.geojson === 'string' ? JSON.parse(el.geojson) : el.geojson;
        const style = typeof el.style === 'string' ? JSON.parse(el.style) : el.style;
        
        // Mapeamento exato para o padrão solicitado
        const isPoint = el.element_type === 'point';
        const isLine = el.element_type === 'line';
        const isPolygon = el.element_type === 'polygon';

        const currentColor = isPoint ? (style.icon_color || "#F97316") : (isLine ? (style.color || "#F97316") : (style.border_color || "#F97316"));

        const properties = {
          Name: el.name || "",
          Tipo: el.element_category || (isPoint ? "Ponto" : isLine ? "Linha" : "Polígono"),
          color: currentColor,
          weight: String(isPoint ? 0 : (isLine ? (style.weight || 3) : (style.border_weight || 2))),
          mapa_id: parseInt(mapId),
          opacity: String((isLine ? (style.opacity || 100) : (isPolygon ? (style.border_opacity || 100) : 100)) / 100),
          fillColor: isPolygon ? (style.fill_color || "#FED7AA") : "",
          fillOpacity: isPolygon ? String((style.fill_opacity || 40) / 100) : "",
          Visibilidade: "Sim",
          popupContent: el.description || "",
          size: "medium",
          weight_label: "medium"
        };

        if (isPoint) {
          const iconUrl = await getBase64Svg(style.icon_name, currentColor);
          if (iconUrl) {
            properties.icon = {
              options: {
                iconUrl: iconUrl,
                iconSize: ["medium", "medium"]
              }
            };
          }
          properties.icon_name = style.icon_name;
        }

        // Adiciona dashArray se houver estilo de linha
        if (style.dash_style === 'dashed' || style.border_dash === 'dashed') {
          properties.dashArray = [10, 10];
        } else if (style.dash_style === 'dash-dot' || style.border_dash === 'dash-dot') {
          properties.dashArray = [15, 10, 1, 10];
        }

        return {
          type: 'Feature',
          geometry,
          properties,
          id: el.id
        };
      }));

      const featureCollection = {
        type: 'FeatureCollection',
        features
      };

      const geojsonString = JSON.stringify(featureCollection, null, 2);
      const fileName = `mapa_${mapId}_${new Date().getTime()}.geojson`;

      if (Capacitor.isNativePlatform()) {
        // Grava o arquivo GeoJSON no sistema de arquivos do celular (Cache)
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: geojsonString,
          directory: Directory.Cache,
          encoding: 'utf8' 
        });

        // Compartilha o arquivo físico usando o plugin Share
        await Share.share({
          files: [savedFile.uri], 
          dialogTitle: 'Enviar Arquivo GeoJSON',
        });
      } else {
        const blob = new Blob([geojsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('GeoJSON baixado com sucesso!');
      }
      toast.dismiss(toastId);
    } catch (error) {
      console.error('Falha ao exportar GeoJSON:', error);
      toast.dismiss(toastId);
      toast.error('Erro ao exportar arquivo');
    }
  };

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
        <div className="flex gap-2">
          {canOpen && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 shadow-sm border-primary/20 hover:bg-primary/5"
              onClick={handleOpenExport}
              disabled={!exportEntryReady}
              title={exportEntryReady ? 'Exportar mapa como PNG' : 'Carregando mapa...'}
              data-testid="export-map-button"
            >
              <FileDown className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">{exportEntryReady ? 'Exportar' : 'Carregando...'}</span>
            </Button>
          )}
          <Button
            variant="outline" 
            size="sm" 
            className="h-9 gap-1.5 shadow-sm border-primary/20 hover:bg-primary/5"
            onClick={handleExportGeoJSON}
            title="Baixar todos os dados em GeoJSON"
          >
            <Download className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">GeoJSON</span>
          </Button>
        </div>
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
        />
      </div>

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
          onDelete={(id) => deleteMutation.mutate(id)}
          onClose={() => setEditingElement(null)}
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

      {canOpen && mapId && (
        <ExportMapModal
          open={showExport}
          onClose={handleCloseExport}
          onExport={handleExport}
          elements={elements}
          settings={exportSettings}
          onSettingsChange={handleExportSettingsChange}
          ownershipLost={ownershipLost}
          isExporting={isExporting}
          mapId={mapId}
        />
      )}

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