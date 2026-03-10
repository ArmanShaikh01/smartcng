import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// ── HASH IN PATH WORKAROUND ─────────────────────────────────────────────────
// Vite 7 / Rollup 4 normalise file-system paths as URLs internally.
// When the project lives under  D:\C#\...  the '#' is treated as a URL
// fragment separator, breaking every relative import resolution.
//
// Fix: a custom Rollup plugin that intercepts `resolveId` and rewrites any
// resolved IDs that still contain 'C#' to go through the junction
// D:\SmartCNG (which was created with: cmd /c mklink /J D:\SmartCNG "D:\C#\smart cng station")
//
// This only applies when running from the junction path.  If vite is ever
// started from the original C# path the junction rewrite still applies and
// prevents the '#' from reaching Rollup's URL normalization.
// ─────────────────────────────────────────────────────────────────────────────

const JUNCTION = 'D:/SmartCNG'
const HASH_PATH = 'D:/C#/smart cng station'
const HASH_PATH_ENCODED = 'D:/C%23/smart%20cng%20station'

/** Replace any occurrence of the real path with the junction path */
function toJunctionPath(id) {
  if (!id) return id
  // Normalize to forward slashes
  const norm = id.replace(/\\/g, '/')
  if (norm.includes('C#') || norm.includes('C%23')) {
    return norm
      .replace(/D:\/C%23\/smart%20cng%20station/g, JUNCTION)
      .replace(/D:\/C#\/smart cng station/g, JUNCTION)
  }
  return id
}

/** Custom plugin: rewrites all module IDs that contain '#' → junction */
function hashPathFixPlugin() {
  return {
    name: 'hash-path-fix',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null
      // If the resolved importer contains '#', redirect through junction
      const fixedImporter = toJunctionPath(importer)
      if (fixedImporter !== importer) {
        // Resolve relative to the junction-fixed importer path
        if (source.startsWith('.')) {
          const importerDir = path.dirname(fixedImporter)
          const resolved = path.resolve(importerDir, source)
          // Check for extension variants
          const exts = ['', '.jsx', '.js', '.ts', '.tsx', '.json', '/index.jsx', '/index.js']
          for (const ext of exts) {
            const candidate = resolved + ext
            if (fs.existsSync(candidate)) {
              return candidate
            }
          }
        }
      }
      return null
    },
    load(id) {
      // Rewrite ID to junction path before loading
      const fixedId = toJunctionPath(id)
      if (fixedId !== id && fs.existsSync(fixedId)) {
        return fs.readFileSync(fixedId, 'utf-8')
      }
      return null
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    hashPathFixPlugin(),
    react(),
  ],

  server: {
    host: true,
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor bundles for smaller initial load
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
        }
      }
    }
  }
})
