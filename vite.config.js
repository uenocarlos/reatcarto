import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const configDir = path.dirname(fileURLToPath(import.meta.url))

function copyIconsIntoAssets() {
  return {
    name: 'copy-icons-into-assets',
    closeBundle() {
      const src = path.resolve(configDir, 'dist/icons')
      const dest = path.resolve(configDir, 'dist/assets/icons')
      if (!fs.existsSync(src)) return
      fs.mkdirSync(dest, { recursive: true })
      for (const file of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Absolute URLs so /editor/:id on Apache does not request /editor/assets/*.
  base: '/',
  plugins: [
    react(),
    copyIconsIntoAssets(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(configDir, "./src"),
    },
  },
  server: {
    proxy: {
      '/php': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    modulePreload: {
      resolveDependencies(filename, deps) {
        if (!filename.includes('index')) return deps;
        return deps.filter((dep) =>
          !/MapEditor|DashBoard|LeafletMap|leaflet|fabric|export-pdf|ExportMapShell|MemorialDialog|IconCanvasEditor/i.test(dep)
        );
      },
    },
    rollupOptions: {
      output: {
        // Merge lucide/icon micro-chunks so HTTP/1.1 WAN is not 40+ round-trips.
        experimentalMinChunkSize: 60000,
      },
    },
  },
});
