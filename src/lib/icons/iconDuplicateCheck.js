import { normalizeIconName } from '@/lib/icons/iconExport';

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function iconNamesMatch(a, b) {
  const left = normalizeIconName(a).toLowerCase();
  const right = normalizeIconName(b).toLowerCase();
  return Boolean(left) && left === right;
}

/**
 * @param {Array<{ id?: string; name?: string; url?: string }>} icons
 * @param {unknown} name
 */
export function findLibraryIconByName(icons, name) {
  if (!Array.isArray(icons) || icons.length === 0) return null;
  return icons.find((icon) => iconNamesMatch(icon?.name, name)) ?? null;
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function hashIconBlob(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16)}:${bytes.length}`;
}

/**
 * @param {string} url
 * @returns {Promise<Blob | null>}
 */
export async function fetchIconBlob(url) {
  const href = String(url ?? '').trim();
  if (!href) return null;
  const response = await fetch(href, { credentials: 'include' });
  if (!response.ok) return null;
  return response.blob();
}

/**
 * @param {Array<{ id?: string; name?: string; url?: string }>} icons
 * @param {Blob} blob
 * @param {(url: string) => Promise<Blob | null>} [loadBlob]
 */
export async function findLibraryIconByContent(icons, blob, loadBlob = fetchIconBlob) {
  if (!Array.isArray(icons) || icons.length === 0 || !blob) return null;
  const target = await hashIconBlob(blob);

  for (const icon of icons) {
    try {
      const existing = await loadBlob(String(icon?.url ?? ''));
      if (!existing) continue;
      const hash = await hashIconBlob(existing);
      if (hash === target) return icon;
    } catch {
      // skip icons that cannot be fetched/hashed
    }
  }

  return null;
}

/**
 * @param {{
 *   nameMatch?: { id?: string; name?: string } | null;
 *   contentMatch?: { id?: string; name?: string } | null;
 * }} matches
 */
export function classifyIconDuplicate({ nameMatch = null, contentMatch = null } = {}) {
  if (nameMatch && contentMatch) {
    if (String(nameMatch.id ?? '') && String(nameMatch.id) === String(contentMatch.id)) {
      return { kind: 'exact', icon: nameMatch };
    }
    return { kind: 'both', nameIcon: nameMatch, contentIcon: contentMatch };
  }
  if (nameMatch) return { kind: 'name', icon: nameMatch };
  if (contentMatch) return { kind: 'content', icon: contentMatch };
  return { kind: 'none' };
}

/**
 * @param {ReturnType<typeof classifyIconDuplicate>} conflict
 * @param {string} [requestedName]
 */
export function duplicateWarningMessage(conflict, requestedName = '') {
  const requested = normalizeIconName(requestedName);

  if (conflict?.kind === 'exact') {
    return `Este ícone já está na biblioteca como "${conflict.icon.name}". Deseja salvar outra cópia?`;
  }
  if (conflict?.kind === 'name') {
    return `Já existe outro ícone chamado "${conflict.icon.name}". Deseja salvar mesmo assim?`;
  }
  if (conflict?.kind === 'content') {
    const newName = requested && !iconNamesMatch(requested, conflict.icon.name)
      ? ` com o nome "${requested}"`
      : '';
    return `Este desenho já está salvo como "${conflict.icon.name}". Deseja salvar de novo${newName}?`;
  }
  if (conflict?.kind === 'both') {
    return `O nome "${conflict.nameIcon.name}" já está em uso e este desenho já existe como "${conflict.contentIcon.name}". Deseja salvar mesmo assim?`;
  }
  return '';
}

/**
 * @param {Array<{ id?: string; name?: string; url?: string }>} icons
 * @param {Blob} blob
 * @param {unknown} name
 * @param {{ fetchIconBlob?: (url: string) => Promise<Blob | null> }} [options]
 */
export async function inspectIconDuplicates(icons, blob, name, options = {}) {
  const nameMatch = findLibraryIconByName(icons, name);
  const contentMatch = await findLibraryIconByContent(
    icons,
    blob,
    options.fetchIconBlob ?? fetchIconBlob,
  );
  return classifyIconDuplicate({ nameMatch, contentMatch });
}
