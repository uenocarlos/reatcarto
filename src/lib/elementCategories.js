/** @typedef {{ id: string, label: string, builtin?: boolean }} ElementCategory */

export const BUILTIN_CATEGORY_IDS = Object.freeze([
  'terra',
  'agua',
  'conflito',
]);

/** @type {ReadonlyArray<ElementCategory>} */
export const DEFAULT_ELEMENT_CATEGORIES = Object.freeze([
  { id: 'terra', label: 'Terra', builtin: true },
  { id: 'agua', label: 'Água', builtin: true },
  { id: 'conflito', label: 'Conflito', builtin: true },
]);

const BUILTIN_SET = new Set(BUILTIN_CATEGORY_IDS);

/**
 * @param {string} label
 * @returns {string}
 */
export function slugifyCategoryLabel(label) {
  const normalized = String(label ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return normalized || 'tipo_personalizado';
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeCategoryId(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return 'terra';
  if (BUILTIN_SET.has(key)) return key;
  if (/^[a-z0-9_]+$/.test(key)) return key;
  return slugifyCategoryLabel(key);
}

/**
 * @param {unknown} entry
 * @returns {ElementCategory|null}
 */
export function normalizeCategoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const label = String(entry.label ?? entry.name ?? '').trim();
  const id = normalizeCategoryId(entry.id ?? entry.slug ?? label);
  if (!label) return null;
  return {
    id,
    label,
    builtin: Boolean(entry.builtin) || BUILTIN_SET.has(id),
  };
}

/**
 * @param {Array<unknown>} categories
 * @returns {ElementCategory[]}
 */
export function mergeCategoryLists(categories = []) {
  const byId = new Map(DEFAULT_ELEMENT_CATEGORIES.map((category) => [category.id, { ...category }]));

  for (const entry of categories) {
    const normalized = normalizeCategoryEntry(entry);
    if (!normalized) continue;
    if (byId.has(normalized.id) && byId.get(normalized.id)?.builtin) continue;
    byId.set(normalized.id, normalized);
  }

  return Array.from(byId.values());
}

/**
 * @param {Array<unknown>} categories
 * @returns {{ order: string[], labelFor: (id: string) => string }}
 */
export function buildCategoryIndex(categories = []) {
  const merged = mergeCategoryLists(categories);
  const order = merged.map((category) => category.id);
  const labels = Object.fromEntries(merged.map((category) => [category.id, category.label]));

  return {
    order,
    labelFor: (id) => labels[normalizeCategoryId(id)] || labels.outros || String(id ?? ''),
  };
}

/**
 * @param {string} label
 * @param {Array<unknown>} existing
 * @returns {ElementCategory}
 */
export function createCategoryFromLabel(label, existing = []) {
  const trimmed = String(label ?? '').trim();
  const merged = mergeCategoryLists(existing);
  const duplicate = merged.find(
    (category) => category.label.localeCompare(trimmed, 'pt-BR', { sensitivity: 'accent' }) === 0,
  );
  if (duplicate) return duplicate;

  let id = slugifyCategoryLabel(trimmed);
  const used = new Set(merged.map((category) => category.id));
  if (used.has(id)) {
    let suffix = 2;
    while (used.has(`${id}_${suffix}`)) suffix += 1;
    id = `${id}_${suffix}`;
  }

  return { id, label: trimmed, builtin: false };
}
