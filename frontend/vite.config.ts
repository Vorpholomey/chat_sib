import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Vite logs WS proxy teardown (ECONNRESET/EPIPE) as errors; those are normal when a tab closes or the backend restarts. */
const BENIGN_WS_PROXY_CODES = new Set(['ECONNRESET', 'EPIPE', 'ECONNABORTED'])

function devLogger() {
  const logger = createLogger()
  const origError = logger.error.bind(logger)
  logger.error = (msg, options) => {
    const err = options?.error as NodeJS.ErrnoException | undefined
    if (
      typeof msg === 'string' &&
      (msg.includes('ws proxy error:') || msg.includes('ws proxy socket error:')) &&
      err?.code &&
      BENIGN_WS_PROXY_CODES.has(err.code)
    ) {
      return
    }
    origError(msg, options)
  }
  return logger
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  customLogger: devLogger(),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        // HTTP URL + ws:true is what http-proxy expects for WebSocket upgrades (not ws://…).
        target: 'http://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
      },
    },
  },
})
