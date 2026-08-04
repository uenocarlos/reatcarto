const listeners = new Map();

function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
}

function off(type, fn) {
  listeners.get(type)?.delete(fn);
}

const bounds = {
  isValid: () => true,
  getCenter: () => ({ lat: -30, lng: -51 }),
  getSouthWest: () => ({ lat: -35, lng: -55 }),
  getNorthEast: () => ({ lat: -25, lng: -45 }),
  getSouth: () => -35,
  getNorth: () => -25,
  getWest: () => -55,
  getEast: () => -45,
};

const mapStubApi = {
  on,
  off,
  addLayer: () => {},
  removeLayer: () => {},
  addControl: () => {},
  removeControl: () => {},
  hasLayer: () => false,
  invalidateSize: () => {},
  getBounds: () => bounds,
  getCenter: () => ({ lat: -30, lng: -51 }),
  getZoom: () => 8,
  getContainer: () => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.className = 'leaflet-container';
    const bl = document.createElement('div');
    bl.className = 'leaflet-bottom leaflet-left';
    el.appendChild(bl);
    return el;
  },
  eachLayer: () => {},
  fitBounds: () => {},
  latLngToContainerPoint: () => ({ x: 0, y: 0 }),
};

function Control() {
  return {
    onAdd: () => {
      if (typeof document === 'undefined') return { className: '' };
      return document.createElement('div');
    },
    addTo: () => this,
    options: {},
  };
}

Control.extend = (proto) => {
  function Ctor(options) {
    this.options = { ...options };
    Object.assign(this, proto);
  }
  Ctor.prototype = proto;
  return Ctor;
};

const L = {
  divIcon: (options) => options,
  geoJSON: () => ({ getBounds: () => bounds }),
  latLngBounds: () => bounds,
  TileLayer: function TileLayer() {},
  control: Object.assign((opts) => {
    const c = {
      options: opts || {},
      onAdd: null,
      addTo() { return this; },
    };
    return c;
  }, {
    graphicScale: (opts) => ({
      options: opts || {},
      addTo() { return this; },
    }),
  }),
  Control,
  DomUtil: {
    create: (tag, cls) => {
      if (typeof document === 'undefined') return { className: cls || '', innerHTML: '' };
      const el = document.createElement(tag);
      el.className = cls || '';
      return el;
    },
  },
  DomEvent: {
    disableClickPropagation: () => {},
  },
  mapStubApi,
};

export default L;
