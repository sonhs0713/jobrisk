import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import previewAnalyzeHandler from './api/preview/analyze.js'

function agentDebugLog({ runId, hypothesisId, location, message, data }) {
  // #region agent log
  fetch('http://127.0.0.1:7579/ingest/be5faab1-4bf7-4191-81cc-c89d7a00a55b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dc5642' },
    body: JSON.stringify({
      sessionId: 'dc5642',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

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
          agentDebugLog({
            runId: 'pre-fix',
            hypothesisId: 'H1',
            location: 'vite.config.js:api_middleware_enter',
            message: 'Vite middleware received /api/preview/analyze',
            data: { method: req.method || '', url: req.url || '' },
          })
          if ((req.method || '').toUpperCase() !== 'POST') return next()
          const apiRes = createVercelLikeRes(res)
          try {
            return previewAnalyzeHandler(req, apiRes)
          } catch (error) {
            agentDebugLog({
              runId: 'pre-fix',
              hypothesisId: 'H3',
              location: 'vite.config.js:api_middleware_error',
              message: 'previewAnalyzeHandler threw synchronously',
              data: { errorName: error?.name || '', errorMessage: error?.message || '' },
            })
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
