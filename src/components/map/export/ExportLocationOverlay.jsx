import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import { filterPolygonFeatures } from './geoPolygonUtils';

const MUNICIPIOS_FILE_BY_UF = Object.freeze({
  AC: 'ac',
  AL: 'al',
  AM: 'am',
  AP: 'ap',
  BA: 'ba',
  CE: 'ce',
  DF: 'df',
  ES: 'es',
  GO: 'go',
  MA: 'ma',
  MG: 'mg',
  MS: 'ms',
  MT: 'mt',
  PA: 'pa',
  PB: 'pb',
  PE: 'pe',
  PI: 'pi',
  PR: 'pr',
  RJ: 'rj',
  RN: 'rn',
  RO: 'ro',
  RR: 'rr',
  RS: 'rs',
  SC: 'sc',
  SE: 'se',
  SP: 'sp',
  TO: 'to',
});

function polygonFilter(feature) {
  const type = feature?.geometry?.type;
  return type === 'Polygon' || type === 'MultiPolygon';
}

function featureProp(feature, keys) {
  for (const key of keys) {
    const value = feature?.properties?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
}

function filterStateFeature(collection, ufSigla) {
  const uf = String(ufSigla ?? '').trim().toUpperCase();
  const features = (collection?.features ?? []).filter((feature) => {
    const sigla = String(featureProp(feature, ['SIGLA_UF', 'sigla', 'uf']) ?? '').toUpperCase();
    return sigla === uf;
  });
  return filterPolygonFeatures({ type: 'FeatureCollection', features });
}

function filterMunicipioFeature(collection, municipioCode) {
  const code = String(municipioCode ?? '').trim();
  if (!code) return { type: 'FeatureCollection', features: [] };
  const features = (collection?.features ?? []).filter((feature) => {
    const values = [
      featureProp(feature, ['CD_MUN', 'cod_ibge', 'id', 'code']),
    ].filter(Boolean).map((value) => String(value).trim());
    return values.some((value) => value === code || value.endsWith(code) || code.endsWith(value));
  });
  return filterPolygonFeatures({ type: 'FeatureCollection', features });
}

async function fetchFeatureCollection(path, fetchFn = fetch) {
  const response = await fetchFn(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return response.json();
}

export default function ExportLocationOverlay({
  locationCount = 0,
  locations = [],
  showMunicipalMesh = false,
  stateOnLegend = false,
  stateColor = '#D9E6A4',
  municipioColor = '#E6A4A4',
  onGeoLoadError,
  fetchFn,
}) {
  const [statesGeoJson, setStatesGeoJson] = useState(null);
  const [municipiosGeoJson, setMunicipiosGeoJson] = useState(null);
  const fetchFnRef = useRef(fetchFn);
  const onGeoLoadErrorRef = useRef(onGeoLoadError);
  const primary = locations?.[0] ?? null;
  const selectedUf = String(primary?.uf ?? '').trim().toUpperCase();
  const municipioCode = String(primary?.municipioCode ?? '').trim();

  useEffect(() => {
    fetchFnRef.current = fetchFn;
    onGeoLoadErrorRef.current = onGeoLoadError;
  }, [fetchFn, onGeoLoadError]);

  useEffect(() => {
    if (locationCount === 0 || (!showMunicipalMesh && !stateOnLegend) || !selectedUf) {
      setStatesGeoJson(null);
      setMunicipiosGeoJson(null);
      return undefined;
    }

    let cancelled = false;
    const doFetch = fetchFnRef.current || fetch;

    (async () => {
      try {
        const tasks = [fetchFeatureCollection('/geo/ufs.geojson', doFetch)];
        if (showMunicipalMesh && municipioCode) {
          const fileId = MUNICIPIOS_FILE_BY_UF[selectedUf] || selectedUf.toLowerCase();
          tasks.push(fetchFeatureCollection(`/geo/municipios/${fileId}.geojson`, doFetch));
        }

        const [statesData, municipiosData = null] = await Promise.all(tasks);
        if (cancelled) return;
        setStatesGeoJson(statesData);
        setMunicipiosGeoJson(municipiosData);
        onGeoLoadErrorRef.current?.(null);
      } catch (error) {
        if (!cancelled) onGeoLoadErrorRef.current?.(String(error?.message ?? error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationCount, municipioCode, selectedUf, showMunicipalMesh, stateOnLegend]);

  const stateFeature = useMemo(
    () => filterStateFeature(statesGeoJson, selectedUf),
    [selectedUf, statesGeoJson],
  );
  const municipioFeature = useMemo(
    () => filterMunicipioFeature(municipiosGeoJson, municipioCode),
    [municipioCode, municipiosGeoJson],
  );

  if (locationCount === 0 || (!showMunicipalMesh && !stateOnLegend)) return null;

  return (
    <>
      {stateOnLegend && stateFeature?.features?.length ? (
        <GeoJSON
          data={stateFeature}
          filter={polygonFilter}
          eventHandlers={{
            add: (event) => {
              event.target?.bringToFront?.();
            },
          }}
          style={() => ({
            color: municipioColor,
            weight: 3,
            dashArray: '8 4',
            fillColor: stateColor,
            fillOpacity: 0,
            opacity: 1,
          })}
        />
      ) : null}

      {showMunicipalMesh && municipioFeature?.features?.length ? (
        <GeoJSON
          data={municipioFeature}
          filter={polygonFilter}
          eventHandlers={{
            add: (event) => {
              event.target?.bringToFront?.();
            },
          }}
          style={() => ({
            color: municipioColor,
            weight: 2.5,
            fillColor: municipioColor,
            fillOpacity: 0,
            opacity: 1,
          })}
        />
      ) : null}
    </>
  );
}
