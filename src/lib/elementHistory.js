/** Máximo de ações de desfazer/refazer na sessão do editor de mapa. */
export const HISTORY_LIMIT = 30;

/**
 * Pilha de ações (criar / atualizar / excluir) para desfazer e refazer no editor.
 */
export function createEmptyHistory() {
  return { undo: [], redo: [] };
}

function trimStack(stack) {
  if (stack.length <= HISTORY_LIMIT) return stack;
  return stack.slice(-HISTORY_LIMIT);
}

export function pushHistoryEntry(history, entry) {
  if (!entry) return history;
  return {
    undo: trimStack([...history.undo, entry]),
    redo: [],
  };
}

export function popUndo(history) {
  if (!history.undo.length) return { history, entry: null };
  const entry = history.undo[history.undo.length - 1];
  return {
    entry,
    history: {
      undo: history.undo.slice(0, -1),
      redo: trimStack([...history.redo, entry]),
    },
  };
}

export function popRedo(history) {
  if (!history.redo.length) return { history, entry: null };
  const entry = history.redo[history.redo.length - 1];
  return {
    entry,
    history: {
      undo: trimStack([...history.undo, entry]),
      redo: history.redo.slice(0, -1),
    },
  };
}

/** Snapshot serializável mínimo para recriar/restaurar um elemento. */
export function snapshotElement(el) {
  if (!el) return null;
  return {
    id: el.id,
    map_id: el.map_id,
    element_type: el.element_type,
    geojson: typeof el.geojson === 'string' ? el.geojson : JSON.stringify(el.geojson ?? {}),
    name: el.name ?? '',
    description: el.description ?? '',
    element_category: el.element_category || 'terra',
    style: typeof el.style === 'string' ? el.style : JSON.stringify(el.style ?? {}),
    is_publicly_visible: el.is_publicly_visible !== false && el.is_publicly_visible !== 0,
    version: el.version,
    photos: el.photos ?? [],
    photo_urls: el.photo_urls ?? [],
    video_urls: el.video_urls ?? [],
  };
}

/** Compara conteúdo restaurável (ignora version/mídia que não entram no undo). */
export function snapshotsContentEqual(a, b) {
  if (!a || !b) return a === b;
  return (
    String(a.element_type) === String(b.element_type) &&
    String(a.name ?? '') === String(b.name ?? '') &&
    String(a.description ?? '') === String(b.description ?? '') &&
    String(a.element_category || 'terra') === String(b.element_category || 'terra') &&
    Boolean(a.is_publicly_visible !== false && a.is_publicly_visible !== 0) ===
      Boolean(b.is_publicly_visible !== false && b.is_publicly_visible !== 0) &&
    normalizeJsonString(a.geojson) === normalizeJsonString(b.geojson) &&
    normalizeJsonString(a.style) === normalizeJsonString(b.style)
  );
}

function normalizeJsonString(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const str = String(value);
  try {
    return JSON.stringify(JSON.parse(str));
  } catch {
    return str;
  }
}

export function createPayloadFromSnapshot(snap) {
  return {
    map_id: snap.map_id,
    element_type: snap.element_type,
    geojson: snap.geojson,
    name: snap.name,
    description: snap.description,
    element_category: snap.element_category || 'terra',
    style: snap.style,
    is_publicly_visible: snap.is_publicly_visible !== false && snap.is_publicly_visible !== 0,
  };
}

export function updatePayloadFromSnapshot(snap) {
  return {
    name: snap.name,
    description: snap.description,
    element_category: snap.element_category,
    style: snap.style,
    geojson: snap.geojson,
    is_publicly_visible: snap.is_publicly_visible !== false && snap.is_publicly_visible !== 0,
  };
}
