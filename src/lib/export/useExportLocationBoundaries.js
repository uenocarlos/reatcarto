import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BoundaryUnavailableError,
  getLocatorGeometries,
  listMunicipalities,
  listStates,
} from '@/lib/export/brazilBoundaries';
import {
  applyStateChange,
  filterMunicipalities,
  reconcileLocationSettings,
  validateMunicipalityForState,
} from '@/lib/export/locationPreview';
import { normalizeExportSettings } from '@/lib/export/exportSettings';

/**
 * @param {{
 *   settings: Record<string, unknown>,
 *   onSettingsChange?: (patch: Record<string, unknown>) => void,
 *   enabled?: boolean,
 * }} params
 */
export function useExportLocationBoundaries({ settings, onSettingsChange, enabled = true }) {
  const normalized = useMemo(() => normalizeExportSettings(settings), [settings]);
  const [states, setStates] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [catalogSource, setCatalogSource] = useState(null);
  const [boundaryResult, setBoundaryResult] = useState(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryError, setBoundaryError] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setCatalogLoading(true);
    listStates()
      .then((result) => {
        if (cancelled) return;
        setStates(result.items);
        setCatalogSource(result.source);
        // Reconcile state only; municipality membership is validated after listMunicipalities.
        const stateOnlyReconciled = reconcileLocationSettings(
          { ...normalized, municipalityCode: null },
          result.items,
          []
        );
        const nextStateCode = stateOnlyReconciled.stateCode;
        const nextMunicipalityCode = nextStateCode === null ? null : normalized.municipalityCode;
        if (
          nextStateCode !== normalized.stateCode ||
          nextMunicipalityCode !== normalized.municipalityCode
        ) {
          onSettingsChange?.({
            stateCode: nextStateCode,
            municipalityCode: nextMunicipalityCode,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setBoundaryError(new BoundaryUnavailableError());
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!normalized.stateCode) {
      setMunicipalities([]);
      return undefined;
    }

    if (!enabled) {
      return undefined;
    }
    let cancelled = false;
    listMunicipalities(normalized.stateCode)
      .then((result) => {
        if (cancelled) return;
        setMunicipalities(result.items);
        if (
          normalized.municipalityCode &&
          !validateMunicipalityForState(normalized.municipalityCode, normalized.stateCode, result.items)
        ) {
          onSettingsChange?.({ municipalityCode: null });
        }
      })
      .catch(() => {
        if (!cancelled) setMunicipalities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, normalized.stateCode, normalized.municipalityCode]);

  useEffect(() => {
    if (!enabled) {
      setBoundaryLoading(false);
      return undefined;
    }

    if (normalized.locatorCount === 0) {
      setBoundaryResult(null);
      setBoundaryError(null);
      setBoundaryLoading(false);
      return undefined;
    }

    if (!normalized.stateCode || !normalized.municipalityCode) {
      setBoundaryResult(null);
      setBoundaryError(null);
      setBoundaryLoading(false);
      return undefined;
    }

    let cancelled = false;
    setBoundaryLoading(true);
    setBoundaryError(null);

    getLocatorGeometries({
      stateCode: normalized.stateCode,
      municipalityCode: normalized.municipalityCode,
      locatorCount: normalized.locatorCount,
      includeMesh: normalized.showMunicipalMesh,
    })
      .then((result) => {
        if (cancelled) return;
        setBoundaryResult(result);
        setBoundaryError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setBoundaryResult(null);
        setBoundaryError(error instanceof BoundaryUnavailableError ? error : new BoundaryUnavailableError());
      })
      .finally(() => {
        if (!cancelled) setBoundaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    normalized.locatorCount,
    normalized.stateCode,
    normalized.municipalityCode,
    normalized.showMunicipalMesh,
  ]);

  const locationLabels = useMemo(() => {
    const state = states.find((s) => String(s.code) === String(normalized.stateCode));
    const municipality = municipalities.find((m) => String(m.code) === String(normalized.municipalityCode));
    return {
      stateName: state?.name ?? state?.sigla,
      municipalityName: municipality?.name,
    };
  }, [states, municipalities, normalized.stateCode, normalized.municipalityCode]);

  const handleStateChange = useCallback(
    (nextStateCode) => {
      onSettingsChange?.(applyStateChange(normalized, nextStateCode));
    },
    [normalized, onSettingsChange]
  );

  const handleMunicipalityChange = useCallback(
    (nextMunicipalityCode) => {
      if (
        nextMunicipalityCode &&
        !validateMunicipalityForState(nextMunicipalityCode, normalized.stateCode, municipalities)
      ) {
        return;
      }
      onSettingsChange?.({ municipalityCode: nextMunicipalityCode || null });
    },
    [municipalities, normalized.stateCode, onSettingsChange]
  );

  return {
    states,
    municipalities,
    catalogSource,
    catalogLoading,
    boundaryResult,
    boundaryLoading,
    boundaryError,
    locationLabels,
    handleStateChange,
    handleMunicipalityChange,
    filterMunicipalities,
  };
}
