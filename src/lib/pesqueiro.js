/** Meses em português (1-indexado: 1 = Janeiro). */
export const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export const MONTH_FULL_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function emptyPescaria() {
  return {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    month_start: 1,
    month_end: 1,
    pescado: '',
    arte_pesca: '',
  };
}

/** Extrai flags/pescarias do JSON de style do elemento. */
export function parsePesqueiroFromStyle(styleRaw) {
  let style = {};
  if (typeof styleRaw === 'string') {
    try {
      style = JSON.parse(styleRaw) || {};
    } catch {
      style = {};
    }
  } else if (styleRaw && typeof styleRaw === 'object') {
    style = styleRaw;
  }

  const isPesqueiro = style.is_pesqueiro === true || style.is_pesqueiro === 1;
  const rawList = Array.isArray(style.pescarias) ? style.pescarias : [];
  const pescarias = rawList
    .map((p) => ({
      id: p.id || emptyPescaria().id,
      month_start: clampMonth(p.month_start ?? p.monthStart ?? 1),
      month_end: clampMonth(p.month_end ?? p.monthEnd ?? 1),
      pescado: String(p.pescado ?? ''),
      arte_pesca: String(p.arte_pesca ?? p.artePesca ?? ''),
    }))
    .filter(Boolean);

  const visualStyle = { ...style };
  delete visualStyle.is_pesqueiro;
  delete visualStyle.pescarias;

  return { isPesqueiro, pescarias, visualStyle };
}

export function clampMonth(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(12, Math.max(1, Math.round(n)));
}

/** Intervalo de meses (suporta virada de ano, ex.: Nov–Fev). */
export function formatMonthRange(start, end) {
  const s = clampMonth(start);
  const e = clampMonth(end);
  if (s === e) return MONTH_FULL_LABELS[s - 1];
  return `${MONTH_FULL_LABELS[s - 1]} – ${MONTH_FULL_LABELS[e - 1]}`;
}

/** Lista de índices 0–11 ativos no intervalo (vira o ano se start > end). */
export function monthsInRange(start, end) {
  const s = clampMonth(start);
  const e = clampMonth(end);
  const active = new Set();
  if (s <= e) {
    for (let m = s; m <= e; m += 1) active.add(m - 1);
  } else {
    for (let m = s; m <= 12; m += 1) active.add(m - 1);
    for (let m = 1; m <= e; m += 1) active.add(m - 1);
  }
  return active;
}

export function mergeStyleWithPesqueiro(visualStyle, isPesqueiro, pescarias) {
  const next = { ...(visualStyle || {}) };
  next.is_pesqueiro = Boolean(isPesqueiro);
  next.pescarias = isPesqueiro
    ? (pescarias || []).map((p) => ({
        id: p.id,
        month_start: clampMonth(p.month_start),
        month_end: clampMonth(p.month_end),
        pescado: String(p.pescado || '').trim(),
        arte_pesca: String(p.arte_pesca || '').trim(),
      }))
    : [];
  return next;
}
