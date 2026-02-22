import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ── Service Worker Registration (vite-plugin-pwa) ──────────────────────────
// Only register in production to avoid dev confusion
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      // Auto-update: reload when new SW is available
      onNeedRefresh() {
        // Auto-reload silently so the user always gets the latest version
        updateSW(true)
      },
      onOfflineReady() {
        console.log('[PWA] App is ready to work offline 🚀')
      },
    })
  }).catch(() => {
    // In development mode, virtual:pwa-register is not available — ignore
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
