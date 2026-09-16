// Private, read-only preview of a generated report. Never uploads or modifies production data.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
const reportPath = process.env.REPORT_PREVIEW_FILE
if (!reportPath) throw new Error('REPORT_PREVIEW_FILE required')
const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 5332, strictPort: true },
  plugins: [vue(), { name: 'report-preview', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      if (!pathname.startsWith('/api/')) return next()
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return }
      if (pathname === '/api/v1/burnout/report') {
        try { res.end(await readFile(reportPath, 'utf8')) } catch { res.statusCode = 500; res.end('{}') }
      } else if (pathname === '/api/v1/employees' || pathname === '/api/v1/deals') res.end('[]')
      else if (pathname === '/api/v1/calls') res.end('{"items":[],"total":0,"page":1,"pageSize":5}')
      else { res.statusCode = 404; res.end('{}') }
    })
  } }],
})
await server.listen()
server.printUrls()
