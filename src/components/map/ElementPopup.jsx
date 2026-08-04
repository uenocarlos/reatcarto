import React from 'react';
import { Popup } from 'react-leaflet';
import { Fish } from 'lucide-react';
import { api } from '@/api/apiClient';
import {
  MONTH_LABELS,
  formatMonthRange,
  monthsInRange,
  parsePesqueiroFromStyle,
} from '@/lib/pesqueiro';

function resolvePhotos(element) {
  if (element?.photos?.length) {
    return element.photos.map((p) => ({
      id: p.id,
      url: p.url || api.media.url(p.id),
    }));
  }
  if (element?.photo_urls?.length) {
    return element.photo_urls.map((url, i) => ({ id: `url-${i}`, url }));
  }
  return [];
}

function MonthCalendarStrip({ monthStart, monthEnd }) {
  const active = monthsInRange(monthStart, monthEnd);
  return (
    <div className="grid grid-cols-6 gap-0.5" aria-hidden="true">
      {MONTH_LABELS.map((label, i) => {
        const on = active.has(i);
        return (
          <span
            key={label}
            className={`text-[9px] leading-none py-1 rounded text-center ${
              on
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function PescariaPopupBlock({ pescaria }) {
  const pescado = (pescaria.pescado || '').trim();
  const arte = (pescaria.arte_pesca || '').trim();
  return (
    <div className="rounded-md border border-border bg-muted/40 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
        <Fish className="w-3 h-3 shrink-0 text-primary" />
        <span>{formatMonthRange(pescaria.month_start, pescaria.month_end)}</span>
      </div>
      <MonthCalendarStrip monthStart={pescaria.month_start} monthEnd={pescaria.month_end} />
      {pescado ? (
        <p className="text-[11px] m-0 leading-snug">
          <span className="text-muted-foreground">Pescado: </span>
          {pescado}
        </p>
      ) : null}
      {arte ? (
        <p className="text-[11px] m-0 leading-snug">
          <span className="text-muted-foreground">Arte de pesca: </span>
          {arte}
        </p>
      ) : null}
    </div>
  );
}

/** Popup Leaflet: nome, descrição, fotos e pescarias (quando houver). */
export default function ElementPopup({ element }) {
  if (!element) return null;

  const name = (element.name || '').trim();
  const description = (element.description || '').trim();
  const photos = resolvePhotos(element);
  const { isPesqueiro, pescarias } = parsePesqueiroFromStyle(element.style);
  const showPesqueiro = isPesqueiro && pescarias.length > 0;

  if (!name && !description && photos.length === 0 && !showPesqueiro) return null;

  return (
    <Popup className="element-popup" maxWidth={280} minWidth={180}>
      <div className="space-y-2 font-sans">
        {name ? (
          <strong className="block text-sm leading-snug text-foreground">{name}</strong>
        ) : (
          <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sem nome
          </span>
        )}
        {description ? (
          <p className="text-xs text-muted-foreground leading-relaxed m-0 whitespace-pre-wrap">
            {description}
          </p>
        ) : null}
        {showPesqueiro ? (
          <div className="space-y-1.5 pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pesqueiro
            </span>
            {pescarias.map((p) => (
              <PescariaPopupBlock key={p.id} pescaria={p} />
            ))}
          </div>
        ) : null}
        {photos.length > 0 ? (
          <div className="flex flex-col gap-1.5 pt-0.5">
            {photos.slice(0, 3).map((photo) => (
              <img
                key={photo.id}
                src={photo.url}
                alt={name || 'Foto do elemento'}
                className="w-full max-h-32 object-cover rounded-md border border-border"
                loading="lazy"
              />
            ))}
            {photos.length > 3 ? (
              <span className="text-[10px] text-muted-foreground">
                +{photos.length - 3} foto(s)
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Popup>
  );
}

export function elementHasPopupContent(element) {
  if (!element) return false;
  if ((element.name || '').trim()) return true;
  if ((element.description || '').trim()) return true;
  if (element.photos?.length || element.photo_urls?.length) return true;
  const { isPesqueiro, pescarias } = parsePesqueiroFromStyle(element?.style);
  if (isPesqueiro && pescarias.length > 0) return true;
  return false;
}
