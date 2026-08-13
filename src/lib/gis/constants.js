export const EXPORT_COORD_PRECISION = 6;
export const SHAPEFILE_VALUE_MAX = 254;
export const GIS_ELEMENT_PAGE_SIZE = 100;

export const ELEMENT_TYPE_LABELS = {
  point: 'Ponto',
  line: 'Linha',
  polygon: 'Polígono',
};

export const GEOJSON_TYPE_BY_ELEMENT = {
  point: 'Point',
  line: 'LineString',
  polygon: 'Polygon',
};

export const SHAPEFILE_LAYER_BY_GEOJSON = {
  Point: 'points',
  MultiPoint: 'points',
  LineString: 'lines',
  MultiLineString: 'lines',
  Polygon: 'polygons',
  MultiPolygon: 'polygons',
};

export const SHAPEFILE_LAYER_LABELS = {
  points: 'Pontos',
  lines: 'Linhas',
  polygons: 'Polígonos',
};

/** Logical export field → DBF name (≤10 chars). */
export const SHAPEFILE_FIELD_MAP = {
  name: 'name',
  description: 'descript',
  category: 'category',
  icon_name: 'icon_name',
  icon_color: 'icon_color',
  custom_icon_url: 'custom_ico',
  color: 'color',
  opacity: 'opacity',
  weight: 'weight',
  dash_style: 'dash_style',
  border_color: 'border_col',
  border_opacity: 'border_opa',
  border_weight: 'border_wei',
  border_dash: 'border_das',
  fill_color: 'fill_color',
  fill_opacity: 'fill_opaci',
};

export const EXPORT_STYLE_KEYS = [
  'icon_name',
  'icon_color',
  'custom_icon_url',
  'color',
  'opacity',
  'weight',
  'dash_style',
  'border_color',
  'border_opacity',
  'border_weight',
  'border_dash',
  'fill_color',
  'fill_opacity',
];
