import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/js/**/*.test.{js,jsx,ts,tsx}'],
    setupFiles: ['tests/js/setup.js'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(configDir, './src'),
      'react-leaflet': path.resolve(configDir, './tests/js/mocks/reactLeafletStub.jsx'),
      'leaflet-auto-graticule': path.resolve(configDir, './tests/js/mocks/leafletAutoGraticuleStub.js'),
      'leaflet-graphicscale/dist/Leaflet.GraphicScale.min.css': path.resolve(configDir, './tests/js/mocks/cssStub.js'),
      'leaflet-graphicscale': path.resolve(configDir, './tests/js/mocks/leafletGraphicScaleStub.js'),
      leaflet: path.resolve(configDir, './tests/js/mocks/leafletStub.js'),
    },
  },
});
