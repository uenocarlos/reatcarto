import {
  BUILTIN_CATEGORY_IDS,
  createCategoryFromLabel,
  mergeCategoryLists,
  normalizeCategoryId,
} from './elementCategories.js';

const LOCAL_STORAGE_PREFIX = 'reatcarto:element-categories:';

/**
 * @param {string|number|null|undefined} userId
 * @returns {string}
 */
function storageKey(userId) {
  return `${LOCAL_STORAGE_PREFIX}${userId ?? 'anonymous'}`;
}

/**
 * @param {string|number|null|undefined} userId
 * @returns {Array<import('./elementCategories.js').ElementCategory>}
 */
export function loadLocalElementCategories(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return mergeCategoryLists(Array.isArray(parsed) ? parsed : [])
      .filter((category) => !category.builtin);
  } catch {
    return [];
  }
}

/**
 * @param {string|number|null|undefined} userId
 * @param {Array<import('./elementCategories.js').ElementCategory>} categories
 */
export function saveLocalElementCategories(userId, categories = []) {
  if (typeof window === 'undefined' || !userId) return;
  const customOnly = mergeCategoryLists(categories).filter((category) => !category.builtin);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(customOnly));
}

/**
 * @param {string} slug
 * @returns {string}
 */
function formatSlugAsLabel(slug) {
  const text = String(slug ?? '').replace(/_/g, ' ').trim();
  if (!text) return 'Tipo personalizado';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Mescla categorias padrão, do servidor e cache local do usuário.
 * @param {Array<unknown>} userCategories
 * @param {string|number|null|undefined} userId
 * @param {Array<{ element_category?: string }>} [elements]
 * @returns {Array<import('./elementCategories.js').ElementCategory>}
 */
export function mergeElementCategories(userCategories = [], userId = null, elements = []) {
  const local = loadLocalElementCategories(userId);
  const fromElements = [];
  const seen = new Set();

  for (const element of elements) {
    const id = normalizeCategoryId(element?.element_category);
    if (seen.has(id)) continue;
    seen.add(id);
    fromElements.push({ id, label: formatSlugAsLabel(id) });
  }

  return mergeCategoryLists([...userCategories, ...local, ...fromElements]);
}

export { createCategoryFromLabel, normalizeCategoryId, BUILTIN_CATEGORY_IDS };
