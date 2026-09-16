// Local visual regression fixture: node tests/ui-preview.mjs
// Uses the real UI with synthetic responses. No production API or uploads.
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const states = ['transcribing', 'analysing', 'completed', 'completed', 'completed']
const names = ['Расшифровка.wav', 'Промежуточный результат.wav', 'Без факторов.wav', 'Только проверка.wav', 'С основаниями.wav']
const timelineSizes = [0, 1, 2, 8, 24]
const factor = { id: 'factor', title: 'Пример фактора', description: 'Тестовое описание для проверки вёрстки.', confidence: 0.85, segmentId: 'segment' }
const snapshots = states.map((state, index) => ({
  id: String(index), state, revision: 1, progress: state === 'completed' ? 100 : 40,
  transcript: [{ id: 'segment', startMs: 0, endMs: 6000, speaker: 'Оператор', text: 'Тестовая реплика для проверки интерфейса.', highlightRanges: [] }],
  analysis: state === 'transcribing' ? null : {
    score: 20, factorsFor: index === 4 ? [factor] : [], factorsAgainst: index >= 3 ? [factor] : [],
    timeline: Array.from({ length: timelineSizes[index] }, (_, pointIndex) => ({ timestampMs: (pointIndex + 1) * 10000, score: 20 })), modelVersion: 'local-ui-fixture',
  },
}))
const history = snapshots.map((snapshot, index) => ({
  id: snapshot.id, fileName: names[index], state: snapshot.state, progress: snapshot.progress,
  score: snapshot.analysis?.score ?? null, dealTitle: 'Тестовая сделка', employeeName: 'Тестовый сотрудник', createdAt: '2026-09-14T04:07:00.000Z',
}))
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  configFile: false,
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  plugins: [vue(), {
    name: 'local-ui-fixtures',
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
        if (!pathname.startsWith('/api')) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return }
        let body
        if (pathname === '/api/v1/employees') body = [{ id: 'employee', name: 'Тестовый сотрудник' }]
        else if (pathname === '/api/v1/deals') body = [{ id: 'deal', title: 'Тестовая сделка', employeeId: 'employee' }]
        else if (pathname === '/api/v1/calls') body = { items: history, total: history.length, page: 1, pageSize: 5 }
        else body = snapshots.find((item) => pathname === `/api/v1/calls/${item.id}`)
        if (!body) res.statusCode = 404
        res.end(JSON.stringify(body ?? {}))
      })
    },
  }],
})
await server.listen()
server.printUrls()
