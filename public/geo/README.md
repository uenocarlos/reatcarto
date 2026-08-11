# Arquivos de malhas (exportador)

Coloque os GeoJSON **estáticos** nestes caminhos (o Vite serve tudo de `public/` na raiz `/`):

```
public/geo/ufs.geojson
public/geo/municipios/{CODIGO_IBGE_UF}.geojson
```

## Estados — `public/geo/ufs.geojson`

FeatureCollection com um polígono (ou MultiPolygon) por UF.

Propriedades esperadas por feature:

| propriedade | exemplo | uso |
|---|---|---|
| `sigla` | `"BA"` | filtro por UF no seletor |
| `id` | `"29"` | código IBGE da UF (liga o arquivo de municípios) |
| `nome` | `"Bahia"` | rótulo na legenda/inset |

## Municípios — `public/geo/municipios/{código}.geojson`

Um arquivo por UF, nomeado com o **código IBGE numérico** da UF:

| UF | arquivo |
|---|---|
| BA | `public/geo/municipios/29.geojson` |
| DF | `public/geo/municipios/53.geojson` |
| SP | `public/geo/municipios/35.geojson` |
| … | … |

Cada feature deve ser **Polygon** ou **MultiPolygon** (não Point — Point vira marker no Leaflet).

Propriedades esperadas:

| propriedade | exemplo | uso |
|---|---|---|
| `id` / `cod_ibge` / `CD_MUN` | `"2900108"` | filtro por código IBGE do município |
| `nome` | `"Acajutiba"` | rótulo |
| `uf` | `"BA"` | opcional |

## Chamadas no código

- Estados: `GET /geo/ufs.geojson` — `ExportLocationInsets.jsx`
- Municípios/malha: `GET /geo/municipios/{code}.geojson` — mesmo componente, ao marcar **Malha municipal**
- Busca de cidades (editor): `GET /geo/municipios-search-index.json` — índice leve gerado por `node scripts/build-municipios-search-index.mjs`
