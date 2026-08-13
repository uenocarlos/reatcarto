import React, { useId } from 'react';
import { Label } from '@/components/ui/label';

/** 20 cores cartográficas distintas para escolha rápida. */
export const MAP_PRESET_COLORS = [
  '#EF4444', // vermelho
  '#F97316', // laranja (padrão app)
  '#F59E0B', // âmbar
  '#EAB308', // amarelo
  '#84CC16', // lima
  '#22C55E', // verde
  '#10B981', // esmeralda
  '#14B8A6', // teal
  '#06B6D4', // ciano
  '#0EA5E9', // céu
  '#3B82F6', // azul
  '#6366F1', // índigo
  '#8B5CF6', // violeta
  '#A855F7', // roxo
  '#EC4899', // rosa
  '#F43F5E', // rose
  '#78716C', // pedra
  '#64748B', // ardósia
  '#1E293B', // quase preto
  '#FFFFFF', // branco
];

function normalizeHex(value) {
  const raw = String(value || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
    const [, a, b, c] = raw;
    return `#${a}${a}${b}${b}${c}${c}`.toUpperCase();
  }
  return '#F97316';
}

/**
 * Grade de 20 cores pré-definidas + color picker nativo.
 * @param {{ label: string, value: string, onChange: (hex: string) => void, id?: string, disabled?: boolean }} props
 */
export default function ColorField({ label, value, onChange, id, disabled = false }) {
  const autoId = useId();
  const pickerId = id || autoId;
  const current = normalizeHex(value);
  const isLight = current === '#FFFFFF' || current === '#F8FAFC' || current === '#FEF3C7';

  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      <Label htmlFor={pickerId} className="text-xs mb-2 block">{label}</Label>
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {MAP_PRESET_COLORS.map((hex) => {
          const selected = current === normalizeHex(hex);
          const light = hex.toUpperCase() === '#FFFFFF';
          return (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-label={`Cor ${hex}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(hex)}
              className={`h-7 w-full rounded-md border transition-all ${
                selected
                  ? 'ring-2 ring-primary ring-offset-1 border-primary'
                  : light
                    ? 'border-muted-foreground/40 hover:border-muted-foreground'
                    : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          id={pickerId}
          type="color"
          value={current}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5 disabled:cursor-not-allowed"
          title="Escolher cor personalizada"
          aria-label={`${label} — seletor personalizado`}
        />
        <span
          className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-mono tabular-nums ${
            isLight ? 'bg-muted' : ''
          }`}
          style={!isLight ? { backgroundColor: `${current}22` } : undefined}
        >
          {current}
        </span>
      </div>
    </div>
  );
}
