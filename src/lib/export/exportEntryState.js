import { canOpenExport, isExportEntryReady, shouldMountExportModal } from './exportGates';

/**
 * Pure state machine for editor export entry (open/cancel/idempotent open).
 */
export function createExportEntryState(initial = {}) {
  let showExport = Boolean(initial.showExport);
  let exportInvoked = false;

  return {
    getShowExport: () => showExport,
    wasExportInvoked: () => exportInvoked,
    openExport({ isOwner, mapId, mapDataReady }) {
      if (!canOpenExport({ isOwner, mapId })) {
        return { showExport, blocked: true };
      }
      if (!isExportEntryReady({ mapDataReady, mapId })) {
        return { showExport, blocked: true, reason: 'loading' };
      }
      showExport = true;
      return { showExport, blocked: false };
    },
    closeExport() {
      showExport = false;
      return { showExport };
    },
    recordExportAttempt() {
      exportInvoked = true;
    },
    resetExportAttempt() {
      exportInvoked = false;
    },
    shouldMountModal({ isOwner, mapId }) {
      return shouldMountExportModal({ isOwner, mapId }) && showExport;
    },
  };
}
