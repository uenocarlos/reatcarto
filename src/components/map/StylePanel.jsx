import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, Camera, Video, Save, MapPin, Circle, Square, Triangle, Star, Heart, Flag, Home, Anchor, 
  Camera as CameraIcon, Trees, Car, AlertTriangle, Info, MapPin as PinIcon, 
  Ghost, Skull, Flame, Ship, Waves, Fish, LayoutGrid, Type, Plus, Pencil, Trash2
} from 'lucide-react';
import { api } from '@/api/apiClient';
import { toast } from 'sonner';
import { storeForUser, getOfflineUserId } from '@/lib/offline/offlineApi';
import {
  MONTH_LABELS,
  emptyPescaria,
  clampMonth,
  formatMonthRange,
  monthsInRange,
  mergeStyleWithPesqueiro,
  parsePesqueiroFromStyle,
} from '@/lib/pesqueiro';

/** Seletor de intervalo de meses (clique no início e no fim). */
function MonthRangePicker({ monthStart, monthEnd, onChange }) {
  const start = clampMonth(monthStart);
  const end = clampMonth(monthEnd);
  const active = monthsInRange(start, end);
  const [picking, setPicking] = React.useState(null);

  const handleClick = (monthIndex) => {
    const month = monthIndex + 1;
    if (picking === null) {
      setPicking(month);
      onChange({ month_start: month, month_end: month });
      return;
    }
    onChange({ month_start: picking, month_end: month });
    setPicking(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-6 gap-1">
        {MONTH_LABELS.map((label, i) => {
          const on = active.has(i);
          const isEdge = i + 1 === start || i + 1 === end;
          return (
            <button
              key={label}
              type="button"
              onClick={() => handleClick(i)}
              className={`text-[10px] py-1.5 rounded-md border transition-colors ${
                on
                  ? isEdge
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-primary/15 text-foreground border-primary/40'
                  : 'bg-muted/40 border-transparent hover:bg-accent text-muted-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        {picking !== null
          ? 'Clique no mês final'
          : `${formatMonthRange(start, end)} · clique em dois meses para o período`}
      </p>
    </div>
  );
}

function PescariaFormCard({
  pescaria,
  index,
  total,
  onChange,
  onRemove,
  onDone,
}) {
  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">Pescaria {index + 1}</span>
        <div className="flex items-center gap-1">
          {onDone ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onDone}>
              Concluir
            </Button>
          ) : null}
          {total > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Remover
            </Button>
          ) : null}
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">Período da pesca</Label>
        <MonthRangePicker
          monthStart={pescaria.month_start}
          monthEnd={pescaria.month_end}
          onChange={({ month_start, month_end }) =>
            onChange({ ...pescaria, month_start, month_end })
          }
        />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Pescado</Label>
        <Input
          value={pescaria.pescado}
          onChange={(e) => onChange({ ...pescaria, pescado: e.target.value })}
          placeholder="ex: tainha, Corvina...."
          className="text-xs h-9"
        />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Arte de pesca</Label>
        <Input
          value={pescaria.arte_pesca}
          onChange={(e) => onChange({ ...pescaria, arte_pesca: e.target.value })}
          placeholder="ex: Emalhe, Avião/saquinho...."
          className="text-xs h-9"
        />
      </div>
    </div>
  );
}

function MonthCalendarReadOnly({ monthStart, monthEnd }) {
  const active = monthsInRange(monthStart, monthEnd);
  return (
    <div className="grid grid-cols-6 gap-0.5">
      {MONTH_LABELS.map((label, i) => (
        <span
          key={label}
          className={`text-[9px] leading-none py-1 rounded text-center ${
            active.has(i)
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

const POINT_ICONS = [
  // Ícones Internos (Suportam troca de cor)
  { name: 'pin', label: 'Pin Padrão', icon: MapPin },
  { name: 'circle', label: 'Círculo', icon: Circle },
  { name: 'square', label: 'Quadrado', icon: Square },
  { name: 'triangle', label: 'Triângulo', icon: Triangle },
  { name: 'star', label: 'Estrela', icon: Star },
  { name: 'heart', label: 'Coração', icon: Heart },
  { name: 'flag', label: 'Bandeira', icon: Flag },
  { name: 'home', label: 'Casa', icon: Home },
  { name: 'anchor', label: 'Âncora', icon: Anchor },
  { name: 'camera', label: 'Câmera', icon: CameraIcon },
  { name: 'tree', label: 'Árvore', icon: Trees },
  { name: 'car', label: 'Carro', icon: Car },
  { name: 'alert', label: 'Alerta', icon: AlertTriangle },
  { name: 'info', label: 'Informação', icon: Info },

  // Ícones da Pasta Public (Arquivos SVG fixos)
  // Números
  ...Array.from({ length: 10 }, (_, i) => ({
    name: `/icons/numero${i}.svg`,
    label: `Número ${i}`,
    icon: Type
  })),

  // Básicos
  { name: '/icons/quadrado.svg', label: 'Quadrado (SVG)', icon: Square },
  { name: '/icons/gota.svg', label: 'Gota', icon: PinIcon },
  { name: '/icons/exagono.svg', label: 'Hexágono', icon: LayoutGrid },
  { name: '/icons/triangulo.svg', label: 'Triângulo (SVG)', icon: Triangle },
  { name: '/icons/raio.svg', label: 'Raio', icon: Flame },
  { name: '/icons/circulo.svg', label: 'Círculo (SVG)', icon: Circle },
  { name: '/icons/lua.svg', label: 'Lua', icon: Ghost },
  { name: '/icons/star.svg', label: 'Estrela (SVG)', icon: Star },
  { name: '/icons/coracao.svg', label: 'Coração (SVG)', icon: Heart },
  { name: '/icons/carro-mercado.svg', label: 'Carrinho', icon: Car },
  { name: '/icons/balaoconversa.svg', label: 'Balão', icon: Info },
  { name: '/icons/camera.svg', label: 'Câmera (SVG)', icon: CameraIcon },
  { name: '/icons/arvore01.svg', label: 'Árvore (SVG)', icon: Trees },
  { name: '/icons/justica.svg', label: 'Justiça', icon: PinIcon },
  { name: '/icons/plataforma.svg', label: 'Plataforma', icon: Ship },
  { name: '/icons/placa01.svg', label: 'Placa', icon: PinIcon },
  { name: '/icons/energiasolar.svg', label: 'Solar', icon: Flame },
  { name: '/icons/navio10.svg', label: 'Navio', icon: Ship },
  { name: '/icons/onibus.svg', label: 'Ônibus', icon: Car },
  { name: '/icons/posto-combustivel.svg', label: 'Posto', icon: Car },
  { name: '/icons/passaro01.svg', label: 'Pássaro', icon: Ghost },
  { name: '/icons/pinheiro.svg', label: 'Pinheiro', icon: Trees },

  // Localização
  { name: '/icons/bandeira02.svg', label: 'Bandeira (SVG)', icon: Flag },
  { name: '/icons/localiza.svg', label: 'Localiza', icon: PinIcon },
  { name: '/icons/marcador.svg', label: 'Marcador', icon: MapPin },

  // Comunidade
  { name: '/icons/cemiterio.svg', label: 'Cemitério', icon: Ghost },
  { name: '/icons/bancalocal.svg', label: 'Banca', icon: Home },
  { name: '/icons/casa.svg', label: 'Casa (SVG)', icon: Home },
  { name: '/icons/docas-mercado.svg', label: 'Docas', icon: Ship },
  { name: '/icons/escola-fundamental.svg', label: 'Escola Fund.', icon: Home },
  { name: '/icons/igreja.svg', label: 'Igreja', icon: Home },
  { name: '/icons/restaurante.svg', label: 'Restaurante', icon: Home },
  { name: '/icons/oficina.svg', label: 'Oficina', icon: Home },
  { name: '/icons/predio.svg', label: 'Prédio', icon: Home },
  { name: '/icons/matrizafricana.svg', label: 'Matriz Africana', icon: Home },
  { name: '/icons/igreja-catolica.svg', label: 'Igreja Católica', icon: Home },
  { name: '/icons/igreja-evangelica.svg', label: 'Igreja Evang.', icon: Home },
  { name: '/icons/associacao.svg', label: 'Associação', icon: Home },
  { name: '/icons/iemanja.svg', label: 'Iemanjá', icon: Waves },
  { name: '/icons/escola-medio.svg', label: 'Escola Médio', icon: Home },
  { name: '/icons/saopedro.svg', label: 'São Pedro', icon: Ship },
  { name: '/icons/santo-antonio.svg', label: 'Sto Antônio', icon: Home },
  { name: '/icons/colonia.svg', label: 'Colônia', icon: Home },
  { name: '/icons/irigacao.svg', label: 'Irrigação', icon: Waves },
  { name: '/icons/urbana.svg', label: 'Urbana', icon: Home },
  { name: '/icons/futebol.svg', label: 'Futebol', icon: LayoutGrid },
  { name: '/icons/praca.svg', label: 'Praça', icon: Trees },
  { name: '/icons/bar.svg', label: 'Bar', icon: Home },
  { name: '/icons/clube.svg', label: 'Clube', icon: Home },
  { name: '/icons/cras.svg', label: 'CRAS', icon: Home },
  { name: '/icons/salao-comunitario.svg', label: 'Salão Comum.', icon: Home },
  { name: '/icons/posto-de-saude.svg', label: 'Posto Saúde', icon: Home },
  { name: '/icons/barraca.svg', label: 'Barraca', icon: Home },

  // Conflitos
  { name: '/icons/barragem.svg', label: 'Barragem', icon: Waves },
  { name: '/icons/eolica.svg', label: 'Eólica', icon: Flame },
  { name: '/icons/industria.svg', label: 'Indústria', icon: Home },
  { name: '/icons/mineracao.svg', label: 'Mineração', icon: LayoutGrid },
  { name: '/icons/substacao.svg', label: 'Subestação', icon: Flame },
  { name: '/icons/caveira.svg', label: 'Caveira', icon: Skull },
  { name: '/icons/barril.svg', label: 'Barril', icon: Ghost },
  { name: '/icons/fogo.svg', label: 'Fogo', icon: Flame },
  { name: '/icons/agroindustria.svg', label: 'Agroindústria', icon: Home },
  { name: '/icons/aquicultura.svg', label: 'Aquicultura', icon: Waves },
  { name: '/icons/draga.svg', label: 'Draga', icon: Ship },
  { name: '/icons/esgoto.svg', label: 'Esgoto', icon: Waves },
  { name: '/icons/jetsqui.svg', label: 'JetSki', icon: Ship },
  { name: '/icons/porto.svg', label: 'Porto', icon: Ship },
  { name: '/icons/proibido.svg', label: 'Proibido', icon: AlertTriangle },

  // Água e Peixes
  { name: '/icons/estaleiro-comun.svg', label: 'Estaleiro', icon: Ship },
  { name: '/icons/ancora.svg', label: 'Âncora (SVG)', icon: Anchor },
  { name: '/icons/barco01.svg', label: 'Barco 1', icon: Ship },
  { name: '/icons/barco02.svg', label: 'Barco 2', icon: Ship },
  { name: '/icons/barco03.svg', label: 'Barco 3', icon: Ship },
  { name: '/icons/anchova.svg', label: 'Anchova', icon: Fish },
  { name: '/icons/linguado.svg', label: 'Linguado', icon: Fish },
  { name: '/icons/miraguaia.svg', label: 'Miraguaia', icon: Fish },
  { name: '/icons/bagre.svg', label: 'Bagre', icon: Fish },
  { name: '/icons/branca.svg', label: 'Branca', icon: Fish },
  { name: '/icons/camarao-rosa.svg', label: 'Camarão', icon: Fish },
  { name: '/icons/caranguejo.svg', label: 'Caranguejo', icon: Fish },
  { name: '/icons/palometa.svg', label: 'Palometa', icon: Fish },
  { name: '/icons/carpa.svg', label: 'Carpa', icon: Fish },
  { name: '/icons/peixerei.svg', label: 'Peixe Rei', icon: Fish },
  { name: '/icons/pintado.svg', label: 'Pintado', icon: Fish },
  { name: '/icons/corvina.svg', label: 'Corvina', icon: Fish },
  { name: '/icons/siriazul.svg', label: 'Siri Azul', icon: Fish },
  { name: '/icons/foca.svg', label: 'Foca', icon: Waves },
  { name: '/icons/tainha.svg', label: 'Tainha', icon: Fish },
  { name: '/icons/tartaruga.svg', label: 'Tartaruga', icon: Waves },
  { name: '/icons/tilapia.svg', label: 'Tilápia', icon: Fish },
  { name: '/icons/traira.svg', label: 'Traíra', icon: Fish },
  { name: '/icons/jundia.svg', label: 'Jundiá', icon: Fish },
  { name: '/icons/tubarao.svg', label: 'Tubarão', icon: Fish },
  { name: '/icons/lagosta.svg', label: 'Lagosta', icon: Fish },
  { name: '/icons/voga.svg', label: 'Voga', icon: Fish },
  { name: '/icons/arrasto.svg', label: 'Arrasto', icon: Waves },
  { name: '/icons/aviazinho.svg', label: 'Aviãozinho', icon: Waves },
  { name: '/icons/emalhe01.svg', label: 'Emalhe', icon: Waves },
  { name: '/icons/espinhel.svg', label: 'Espinhel', icon: Waves },
];

const LINE_DASH_OPTIONS = [
  { value: 'solid', label: 'Sólido', pattern: null },
  { value: 'dashed', label: 'Tracejado', pattern: '10, 10' },
  { value: 'dash-dot', label: 'Tracejado Pontilhado', pattern: '15, 5, 2, 5' },
];

const defaultStyles = {
  point: { icon_name: 'pin', icon_color: '#F97316', custom_icon_url: '' },
  line: { color: '#F97316', opacity: 100, weight: 3, dash_style: 'solid' },
  polygon: { border_color: '#F97316', border_opacity: 100, border_weight: 2, border_dash: 'solid', fill_color: '#FED7AA', fill_opacity: 40 },
};

export default function StylePanel({ element, onSave, onDelete, onClose, onPreview }) {
  const type = element?.element_type || 'point';
  const existingStyleParsed = element?.style
    ? (typeof element.style === 'string' ? (() => { try { return JSON.parse(element.style); } catch { return {}; } })() : element.style)
    : {};
  const {
    isPesqueiro: initialIsPesqueiro,
    pescarias: initialPescarias,
    visualStyle,
  } = parsePesqueiroFromStyle(existingStyleParsed);

  const seedPescarias = initialPescarias.length > 0 ? initialPescarias : [emptyPescaria()];
  const [style, setStyle] = useState({ ...defaultStyles[type], ...visualStyle });
  const [details, setDetails] = useState({
    name: element?.name || '',
    description: element?.description || '',
    element_category: element?.element_category || 'terra',
    is_publicly_visible: element?.is_publicly_visible !== false && element?.is_publicly_visible !== 0,
  });
  const [isPesqueiro, setIsPesqueiro] = useState(initialIsPesqueiro);
  const [pescarias, setPescarias] = useState(seedPescarias);
  const [editingPescariaIds, setEditingPescariaIds] = useState(() => {
    if (initialPescarias.length === 0) return new Set([seedPescarias[0].id]);
    return new Set();
  });
  const [activeTab, setActiveTab] = useState('style');
  const [photos, setPhotos] = useState(
    (element?.photos ?? []).map((p) => ({
      id: p.id,
      version: p.version,
      url: p.url || api.media.url(p.id),
    }))
  );
  const [videos, setVideos] = useState(element?.video_urls || []);
  const [uploading, setUploading] = useState(false);

  // Notify parent of style changes in real time (preserva dados de pesqueiro)
  useEffect(() => {
    if (onPreview) {
      onPreview({
        style: JSON.stringify(mergeStyleWithPesqueiro(style, isPesqueiro, pescarias)),
        icon_name: style.icon_name,
        icon_color: style.icon_color,
        custom_icon_url: style.custom_icon_url,
      });
    }
  }, [style, isPesqueiro, pescarias]);

  const updateStyle = (updates) => {
    setStyle(prev => ({ ...prev, ...updates }));
  };

  const handlePhotoUpload = async (files) => {
    if (!element?.id || element._isNew) {
      toast.error('Salve o elemento antes de anexar fotos');
      return;
    }
    let dependsOn = null;
    try {
      if (getOfflineUserId()) {
        const store = storeForUser();
        const rows = await store.getAllOutbox();
        const pendingCreate = rows.find(
          (r) =>
            r.resource_type === 'element' &&
            r.op === 'create' &&
            r.resource_id === element.id &&
            r.status === 'pending'
        );
        if (pendingCreate) {
          dependsOn = pendingCreate.client_mutation_id;
        }
      }
    } catch {
      // store unavailable (online-only / no user); ignore and continue without depends_on
    }
    setUploading(true);
    try {
      for (const file of files) {
        if (!file?.size) continue;
        const photo = await api.media.upload(element.id, file, undefined, dependsOn);
        setPhotos((prev) => [
          ...prev,
          {
            id: photo.id,
            version: photo.version ?? 1,
            url: photo.url || api.media.url(photo.id),
          },
        ]);
      }
    } catch (err) {
      toast.error(err.message || 'Falha ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoRemove = async (photoId) => {
    try {
      const photo = photos.find((p) => p.id === photoId);
      const baseVersion = photo?.version;
      await api.media.delete(photoId, baseVersion);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      toast.error(err.message || 'Falha ao remover foto');
    }
  };

  const handleFileUpload = async (files, fileType) => {
    if (fileType === 'photo') {
      await handlePhotoUpload(files);
      return;
    }
    setUploading(true);
    const urls = [];
    for (const file of files) {
      toast.error('Upload de vídeo ainda não disponível');
    }
    if (fileType === 'video') setVideos((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSave = () => {
    const stylePayload = mergeStyleWithPesqueiro(style, isPesqueiro, pescarias);
    onSave({
      ...details,
      style: JSON.stringify(stylePayload),
      icon_name: style.icon_name,
      icon_color: style.icon_color,
      custom_icon_url: style.custom_icon_url,
      photo_urls: photos.map((p) => p.url),
      video_urls: videos,
    });
  };

  const handlePesqueiroChange = (value) => {
    const enabled = value === 'yes';
    setIsPesqueiro(enabled);
    if (enabled) {
      if (pescarias.length === 0) setPescarias([emptyPescaria()]);
      setActiveTab('pesqueiro');
    } else if (activeTab === 'pesqueiro') {
      setActiveTab('details');
    }
  };

  const updatePescaria = (id, next) => {
    setPescarias((prev) => prev.map((p) => (p.id === id ? next : p)));
  };

  const removePescaria = (id) => {
    setPescarias((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (filtered.length > 0) {
        setEditingPescariaIds((e) => {
          const next = new Set(e);
          next.delete(id);
          return next;
        });
        return filtered;
      }
      const fresh = emptyPescaria();
      setEditingPescariaIds(new Set([fresh.id]));
      return [fresh];
    });
  };

  const addPescaria = () => {
    const created = emptyPescaria();
    setPescarias((prev) => [...prev, created]);
    setEditingPescariaIds((prev) => new Set(prev).add(created.id));
  };

  const toggleEditPescaria = (id) => {
    setEditingPescariaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = () => {
    if (window.confirm('Deseja realmente excluir este elemento?')) {
      if (onDelete) {
        onDelete(element.id);
        onClose();
      } else {
        api.entities.MapElement.delete(element.id).then(() => {
          onClose();
        });
      }
    }
  };

  const panelContent = (
    <>
      <div className="flex items-center justify-between p-3 sm:p-4 border-b flex-shrink-0">
        <h3 className="font-semibold text-sm">
          {type === 'point' ? 'Estilizar Ponto' : type === 'line' ? 'Estilizar Linha' : 'Estilizar Polígono'}
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b sticky top-0 z-10 bg-card h-auto flex-wrap">
            <TabsTrigger value="style" className="flex-1 text-xs">Estilo</TabsTrigger>
            <TabsTrigger value="details" className="flex-1 text-xs">Detalhamento</TabsTrigger>
            {isPesqueiro ? (
              <TabsTrigger value="pesqueiro" className="flex-1 text-xs">Pesqueiro</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="style" className="p-3 sm:p-4 space-y-4">
            {type === 'point' && (
              <>
                <div>
                  <Label className="text-xs mb-2 block">Cor do Ícone</Label>
                  <input type="color" value={style.icon_color} onChange={(e) => updateStyle({ icon_color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer border-none p-0" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs block">Ícone</Label>
                    <span className="text-[10px] text-muted-foreground">{POINT_ICONS.length} opções</span>
                  </div>
                  <ScrollArea className="h-96 border rounded-lg p-3 bg-muted/20">
                    <div className="grid grid-cols-5 gap-2">
                      {POINT_ICONS.map(({ name, icon: Icon, label }) => {
                        const isSelected = style.icon_name === name;
                        return (
                          <button
                            key={name}
                            title={label}
                            className={`aspect-square flex items-center justify-center rounded-xl border-2 transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary/20 shadow-inner' 
                                : 'border-transparent hover:bg-accent hover:border-muted-foreground/20'
                            }`}
                            onClick={() => updateStyle({ icon_name: name })}
                          >
                            {name.startsWith('/') ? (
                              <div 
                                style={{ 
                                  width: '24px', 
                                  height: '24px', 
                                  backgroundColor: style.icon_color,
                                  maskImage: `url(${name})`,
                                  WebkitMaskImage: `url(${name})`,
                                  maskSize: 'contain',
                                  WebkitMaskSize: 'contain',
                                  maskRepeat: 'no-repeat',
                                  WebkitMaskRepeat: 'no-repeat',
                                  maskPosition: 'center',
                                  WebkitMaskPosition: 'center'
                                }} 
                              />
                            ) : (
                              <Icon 
                                size={24} 
                                style={{ color: style.icon_color }} 
                                strokeWidth={2.5}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
                
                <div>
                  <Label className="text-xs mb-2 block">Ícone Personalizado (Upload)</Label>
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    toast.error('Ícone personalizado via upload será suportado em versão futura');
                  }} className="text-xs w-full" />
                  {style.custom_icon_url && (
                    <div className="mt-2 p-2 border rounded bg-muted/50 flex items-center gap-2">
                      <img src={style.custom_icon_url} className="w-8 h-8 object-contain" alt="custom icon" />
                      <span className="text-[10px] truncate flex-1">Ícone carregado</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateStyle({ custom_icon_url: '' })}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {type === 'line' && (
              <>
                <div>
                  <Label className="text-xs mb-2 block">Cor da Linha</Label>
                  <input type="color" value={style.color} onChange={(e) => updateStyle({ color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Opacidade: {style.opacity}%</Label>
                  <Slider value={[style.opacity]} onValueChange={([v]) => updateStyle({ opacity: v })} max={100} step={5} />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Espessura: {style.weight}px</Label>
                  <Slider value={[style.weight]} onValueChange={([v]) => updateStyle({ weight: v })} min={1} max={20} step={1} />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Estilo da Linha</Label>
                  <div className="flex flex-col gap-2">
                    {LINE_DASH_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateStyle({ dash_style: option.value })}
                        className={`w-full p-2 rounded-md border-2 transition-all flex items-center justify-center ${
                          (style.dash_style || 'solid') === option.value 
                            ? 'border-primary bg-primary/10' 
                            : 'border-muted hover:bg-accent'
                        }`}
                      >
                        <svg width="100%" height="20" className="overflow-visible">
                          <line 
                            x1="0" y1="10" x2="100%" y2="10" 
                            stroke={style.color || '#F97316'} 
                            strokeWidth="3" 
                            strokeDasharray={option.pattern}
                          />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {type === 'polygon' && (
              <>
                <div>
                  <Label className="text-xs mb-2 block">Cor da Borda</Label>
                  <input type="color" value={style.border_color} onChange={(e) => updateStyle({ border_color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Opacidade Borda: {style.border_opacity}%</Label>
                  <Slider value={[style.border_opacity]} onValueChange={([v]) => updateStyle({ border_opacity: v })} max={100} step={5} />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Espessura Borda: {style.border_weight}px</Label>
                  <Slider value={[style.border_weight]} onValueChange={([v]) => updateStyle({ border_weight: v })} min={1} max={20} step={1} />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Estilo da Borda</Label>
                  <div className="flex flex-col gap-2">
                    {LINE_DASH_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateStyle({ border_dash: option.value })}
                        className={`w-full p-2 rounded-md border-2 transition-all flex items-center justify-center ${
                          (style.border_dash || 'solid') === option.value 
                            ? 'border-primary bg-primary/10' 
                            : 'border-muted hover:bg-accent'
                        }`}
                      >
                        <svg width="100%" height="20" className="overflow-visible">
                          <line 
                            x1="0" y1="10" x2="100%" y2="10" 
                            stroke={style.border_color || '#F97316'} 
                            strokeWidth="3" 
                            strokeDasharray={option.pattern}
                          />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Cor do Preenchimento</Label>
                  <input type="color" value={style.fill_color} onChange={(e) => updateStyle({ fill_color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Opacidade Preenchimento: {style.fill_opacity}%</Label>
                  <Slider value={[style.fill_opacity]} onValueChange={([v]) => updateStyle({ fill_opacity: v })} max={100} step={5} />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="details" className="p-3 sm:p-4 space-y-4">
            <div>
              <Label className="text-xs mb-1 block">Tipo</Label>
              <Select value={details.element_category} onValueChange={(v) => setDetails({ ...details, element_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="terra">Terra</SelectItem>
                  <SelectItem value="agua">Água</SelectItem>
                  <SelectItem value="conflito">Conflito</SelectItem>
                  <SelectItem value="terra_agua">Terra e Água</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Nome</Label>
              <Input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} placeholder="Nome do elemento" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Descrição</Label>
              <Textarea value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} placeholder="Descreva..." rows={3} />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Fotos</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                    <img src={photo.url} className="w-full h-full object-cover" alt="" />
                    <button className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5" onClick={() => handlePhotoRemove(photo.id)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-accent text-xs">
                <Camera className="w-4 h-4" />
                Adicionar Fotos
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handleFileUpload(Array.from(e.target.files || []), 'photo')} />
              </label>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Vídeos</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {videos.map((url, i) => (
                  <div key={i} className="relative px-2 py-1 border rounded text-xs bg-muted">
                    Vídeo {i + 1}
                    <button className="ml-2 text-destructive" onClick={() => setVideos(videos.filter((_, idx) => idx !== i))}>
                      <X className="w-3 h-3 inline" />
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-accent text-xs">
                <Video className="w-4 h-4" />
                Adicionar Vídeos
                <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleFileUpload(Array.from(e.target.files), 'video')} />
              </label>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Visível no mapa público</Label>
              <RadioGroup
                value={details.is_publicly_visible ? 'yes' : 'no'}
                onValueChange={(v) => setDetails({ ...details, is_publicly_visible: v === 'yes' })}
                className="flex flex-row gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="visible-yes" />
                  <Label htmlFor="visible-yes" className="text-xs font-normal cursor-pointer">
                    Sim
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="visible-no" />
                  <Label htmlFor="visible-no" className="text-xs font-normal cursor-pointer">
                    Não
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                Se o mapa for publicado, elementos com &quot;Não&quot; continuam no seu mapa,
                mas não aparecem na visualização pública.
              </p>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Pesqueiro</Label>
              <RadioGroup
                value={isPesqueiro ? 'yes' : 'no'}
                onValueChange={handlePesqueiroChange}
                className="flex flex-row gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="pesqueiro-yes" />
                  <Label htmlFor="pesqueiro-yes" className="text-xs font-normal cursor-pointer">
                    Sim
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="pesqueiro-no" />
                  <Label htmlFor="pesqueiro-no" className="text-xs font-normal cursor-pointer">
                    Não
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                Marque &quot;Sim&quot; para registrar períodos de pesca, pescado e arte de pesca.
              </p>
            </div>
          </TabsContent>

          {isPesqueiro ? (
            <TabsContent value="pesqueiro" className="p-3 sm:p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Fish className="w-4 h-4 text-primary shrink-0" />
                <span>Cadastre uma ou mais pescarias deste local.</span>
              </div>

              <div className="space-y-3">
                {pescarias.map((pescaria, index) => {
                  const isEditing = editingPescariaIds.has(pescaria.id);
                  if (isEditing) {
                    return (
                      <PescariaFormCard
                        key={pescaria.id}
                        pescaria={pescaria}
                        index={index}
                        total={pescarias.length}
                        onChange={(next) => updatePescaria(pescaria.id, next)}
                        onRemove={() => removePescaria(pescaria.id)}
                        onDone={() => toggleEditPescaria(pescaria.id)}
                      />
                    );
                  }
                  return (
                    <div
                      key={pescaria.id}
                      className="rounded-lg border p-3 space-y-2 bg-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-medium m-0">
                            Pescaria {index + 1} ·{' '}
                            {formatMonthRange(pescaria.month_start, pescaria.month_end)}
                          </p>
                          {pescaria.pescado.trim() ? (
                            <p className="text-[11px] text-muted-foreground m-0 truncate">
                              Pescado: {pescaria.pescado}
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground m-0 italic">
                              Sem pescado informado
                            </p>
                          )}
                          {pescaria.arte_pesca.trim() ? (
                            <p className="text-[11px] text-muted-foreground m-0 truncate">
                              Arte: {pescaria.arte_pesca}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleEditPescaria(pescaria.id)}
                            title="Editar pescaria"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {pescarias.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removePescaria(pescaria.id)}
                              title="Remover pescaria"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <MonthCalendarReadOnly
                        monthStart={pescaria.month_start}
                        monthEnd={pescaria.month_end}
                      />
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={addPescaria}
              >
                <Plus className="w-4 h-4" />
                Adicionar pescaria
              </Button>
            </TabsContent>
          ) : null}
        </Tabs>
      </ScrollArea>

      <div className="p-3 sm:p-4 border-t flex-shrink-0 flex gap-2">
        <Button variant="outline" onClick={handleDelete} className="flex-1 text-destructive hover:text-destructive">
          Excluir
        </Button>
        <Button onClick={handleSave} className="flex-[2] gap-2" disabled={uploading || !details.name.trim()}>
          <Save className="w-4 h-4" />
          {uploading ? 'Enviando...' : 'Salvar'}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: side panel */}
      <div className="hidden sm:flex absolute right-0 top-0 bottom-0 w-96 bg-card border-l shadow-2xl z-[1001] flex-col">
        {panelContent}
      </div>

      {/* Mobile: bottom sheet */}
      <div className="sm:hidden absolute inset-x-0 bottom-0 bg-card border-t shadow-2xl z-[1001] flex flex-col rounded-t-2xl" style={{ maxHeight: '75dvh' }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        {panelContent}
      </div>
    </>
  );
}