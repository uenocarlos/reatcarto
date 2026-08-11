import { buildCategoryIndex, normalizeCategoryId } from '../elementCategories.js';

const DEFAULT_STYLE = {
  point: { icon_name: 'pin', icon_color: '#F97316', custom_icon_url: '' },
  line: { color: '#F97316', opacity: 100, weight: 3, dash_style: 'solid' },
  polygon: {
    border_color: '#F97316',
    border_opacity: 100,
    border_weight: 2,
    border_dash: 'solid',
    fill_color: '#FED7AA',
    fill_opacity: 40,
  },
};

export const TYPE_META = Object.freeze({
  point: { label: 'Pontos' },
  line: { label: 'Linhas' },
  polygon: { label: 'Poligonos' },
});

export const TYPE_ORDER = Object.freeze(['point', 'line', 'polygon']);

export const CATEGORY_META = Object.freeze({
  terra: { label: 'Terra' },
  agua: { label: 'Agua' },
  conflito: { label: 'Conflito' },
  outros: { label: 'Outros' },
});

export const CATEGORY_ORDER = Object.freeze(['terra', 'agua', 'conflito', 'outros']);

const DASH_LABELS = Object.freeze({
  solid: 'Solido',
  dashed: 'Tracejado',
  'dash-dot': 'Traco-ponto',
});

const ICON_LABELS = Object.freeze({
  pin: 'Pino',
  circle: 'Circulo',
  square: 'Quadrado',
  triangle: 'Triangulo',
  star: 'Estrela',
  heart: 'Coracao',
  flag: 'Bandeira',
  home: 'Casa',
  anchor: 'Ancora',
  camera: 'Camera',
  tree: 'Arvore',
  car: 'Carro',
  alert: 'Alerta',
  info: 'Info',
});

export function categoryBucket(raw) {
  return normalizeCategoryId(raw);
}

export function parseStyle(el) {
  if (!el?.style) return {};
  if (typeof el.style === 'object') return el.style;
  try {
    return JSON.parse(el.style);
  } catch {
    return {};
  }
}

function normalizeColor(color, fallback) {
  if (!color || typeof color !== 'string') return String(fallback ?? '').toLowerCase();
  return color.trim().toLowerCase();
}

function displayNameFor(el) {
  return (el.name || '').trim() || null;
}

function iconLabel(iconName, customUrl) {
  if (customUrl) return 'Personalizado';
  if (!iconName) return ICON_LABELS.pin;
  if (iconName.startsWith('/') || iconName.startsWith('http') || iconName.endsWith('.svg')) {
    return iconName.split('/').pop()?.replace(/\.svg$/i, '') || 'Icone';
  }
  return ICON_LABELS[iconName] || iconName;
}

export function identityOf(el, type) {
  const name = displayNameFor(el);
  const nameKey = name ? name.toLowerCase() : `__id:${el.id}`;
  const label = name || `Sem nome · ${el.id?.toString?.().slice(0, 6) || '?'}`;
  const raw = parseStyle(el);
  const defaults = DEFAULT_STYLE[type] || {};
  const style = { ...defaults, ...raw };
  const category = categoryBucket(el?.element_category);

  if (type === 'point') {
    const iconName = String(style.icon_name || 'pin');
    const color = normalizeColor(style.icon_color, defaults.icon_color);
    const custom = String(style.custom_icon_url || el.custom_icon_url || '');
    return {
      key: `${category}|${nameKey}|pt|${iconName}|${color}|${custom}`,
      nameKey: name ? nameKey : null,
      label,
      type,
      category,
      style: {
        icon_name: iconName,
        icon_color: color,
        custom_icon_url: custom,
      },
      props: {
        icon: iconLabel(iconName, custom),
        color,
      },
    };
  }

  if (type === 'line') {
    const color = normalizeColor(style.color, defaults.color);
    const opacity = Number(style.opacity ?? defaults.opacity);
    const weight = Number(style.weight ?? defaults.weight);
    const dash = String(style.dash_style || defaults.dash_style);
    return {
      key: `${category}|${nameKey}|ln|${color}|${opacity}|${weight}|${dash}`,
      nameKey: name ? nameKey : null,
      label,
      type,
      category,
      style: {
        color,
        opacity,
        weight,
        dash_style: dash,
      },
      props: {
        color,
        weight: `${weight}px`,
        opacity: `${opacity}%`,
        dash: DASH_LABELS[dash] || dash,
      },
    };
  }

  const borderColor = normalizeColor(style.border_color, defaults.border_color);
  const fillColor = normalizeColor(style.fill_color, defaults.fill_color);
  const borderOpacity = Number(style.border_opacity ?? defaults.border_opacity);
  const borderWeight = Number(style.border_weight ?? defaults.border_weight);
  const borderDash = String(style.border_dash || defaults.border_dash);
  const fillOpacity = Number(style.fill_opacity ?? defaults.fill_opacity);
  return {
    key: `${category}|${nameKey}|pg|${borderColor}|${borderOpacity}|${borderWeight}|${borderDash}|${fillColor}|${fillOpacity}`,
    nameKey: name ? nameKey : null,
    label,
    type,
    category,
    style: {
      border_color: borderColor,
      border_opacity: borderOpacity,
      border_weight: borderWeight,
      border_dash: borderDash,
      fill_color: fillColor,
      fill_opacity: fillOpacity,
    },
    props: {
      border: borderColor,
      fill: fillColor,
      weight: `${borderWeight}px`,
      opacity: `${borderOpacity}%`,
      fillOpacity: `${fillOpacity}%`,
      dash: DASH_LABELS[borderDash] || borderDash,
    },
  };
}

function diffHints(group, siblings) {
  if (siblings.length <= 1) return { swatches: [], hints: [] };

  const propKeys = Object.keys(group.props || {});
  const differing = [];
  for (const key of propKeys) {
    const values = new Set(siblings.map((entry) => String(entry.props?.[key] ?? '')));
    if (values.size > 1) differing.push(key);
  }

  const swatches = [];
  const hints = [];

  if (differing.includes('color')) swatches.push({ color: group.props.color, title: 'Cor' });
  if (differing.includes('border')) swatches.push({ color: group.props.border, title: 'Borda' });
  if (differing.includes('fill')) swatches.push({ color: group.props.fill, title: 'Preenchimento' });

  const nonColor = differing.filter((key) => !['color', 'border', 'fill'].includes(key));
  for (const key of nonColor) {
    const value = group.props?.[key];
    if (!value) continue;
    hints.push(String(value));
  }

  if (swatches.length === 0 && hints.length === 0) {
    if (group.props?.color) swatches.push({ color: group.props.color, title: 'Cor' });
    else if (group.props?.border) swatches.push({ color: group.props.border, title: 'Borda' });
  }

  return { swatches, hints };
}

export function groupElements(list, type) {
  const map = new Map();

  for (const el of list) {
    const identity = identityOf(el, type);
    if (!map.has(identity.key)) {
      map.set(identity.key, {
        key: identity.key,
        label: identity.label,
        nameKey: identity.nameKey,
        ids: [String(el.id)],
        type,
        category: identity.category,
        style: identity.style,
        props: identity.props,
      });
    } else {
      map.get(identity.key).ids.push(String(el.id));
    }
  }

  const groups = Array.from(map.values());
  const byName = new Map();
  for (const group of groups) {
    if (!group.nameKey) continue;
    if (!byName.has(group.nameKey)) byName.set(group.nameKey, []);
    byName.get(group.nameKey).push(group);
  }

  for (const group of groups) {
    const siblings = group.nameKey ? byName.get(group.nameKey) || [group] : [group];
    const { swatches, hints } = diffHints(group, siblings);
    group.swatches = swatches;
    group.hints = hints;
    group.hasNameCollision = siblings.length > 1;
  }

  return groups;
}

export function splitElementsByType(elements = []) {
  const grouped = { point: [], line: [], polygon: [] };
  for (const el of elements) {
    const type = el?.element_type;
    if (grouped[type]) grouped[type].push(el);
  }
  return grouped;
}

export function buildTypeGroups(elements = []) {
  const raw = splitElementsByType(elements);
  return {
    point: groupElements(raw.point, 'point'),
    line: groupElements(raw.line, 'line'),
    polygon: groupElements(raw.polygon, 'polygon'),
    raw,
    counts: {
      point: raw.point.length,
      line: raw.line.length,
      polygon: raw.polygon.length,
    },
  };
}

export function buildCategoryGroups(elements = [], elementCategories = []) {
  const rawByType = splitElementsByType(elements);
  const allGroups = TYPE_ORDER.flatMap((type) => groupElements(rawByType[type], type));
  const index = buildCategoryIndex(elementCategories);
  const usedIds = new Set(elements.map((el) => categoryBucket(el?.element_category)));
  const categoryOrder = [...index.order];
  for (const id of usedIds) {
    if (!categoryOrder.includes(id)) categoryOrder.push(id);
  }

  const raw = Object.fromEntries(categoryOrder.map((category) => [category, []]));
  const counts = Object.fromEntries(categoryOrder.map((category) => [category, 0]));
  const groups = Object.fromEntries(categoryOrder.map((category) => [category, []]));

  for (const el of elements) {
    const category = categoryBucket(el?.element_category);
    if (!raw[category]) {
      raw[category] = [];
      counts[category] = 0;
      groups[category] = [];
      categoryOrder.push(category);
    }
    raw[category].push(el);
    counts[category] += 1;
  }

  for (const category of categoryOrder) {
    groups[category] = allGroups.filter((group) => group.category === category);
  }

  return {
    groups,
    raw,
    counts,
    categoryOrder,
    categoryLabel: (category) => index.labelFor(category) || CATEGORY_META[category]?.label || category,
  };
}

