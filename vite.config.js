import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import previewAnalyzeHandler from './api/preview/analyze.js'

function createVercelLikeRes(nodeRes) {
  const apiRes = {
    status(code) {
      nodeRes.statusCode = Number(code) || 200
      return apiRes
    },
    json(payload) {
      try {
        if (!nodeRes.headersSent) nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8')
      } catch {
        // ignore
      }
      nodeRes.end(JSON.stringify(payload ?? {}))
      return apiRes
    },
    setHeader(name, value) {
      try {
        nodeRes.setHeader(name, value)
      } catch {
        // ignore
      }
      return apiRes
    },
    end(body) {
      nodeRes.end(body)
      return apiRes
    },
  }
  return apiRes
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'jobrisk-local-api-preview-analyze',
      configureServer(server) {
        server.middlewares.use('/api/preview/analyze', (req, res, next) => {
          if ((req.method || '').toUpperCase() !== 'POST') return next()
          const apiRes = createVercelLikeRes(res)
          try {
            return previewAnalyzeHandler(req, apiRes)
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: false, code: 'LOCAL_MIDDLEWARE_ERROR' }))
            return undefined
          }
        })
      },
    },
  ],
})
