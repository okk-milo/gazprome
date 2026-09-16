import assert from 'node:assert/strict'
import test from 'node:test'
import { parseTechnicalResponse, technicalCharts } from '../src/services/technical-dataset.ts'
import { readFile } from 'node:fs/promises'

function fixture() {
  return { state: 'ready', dataset: { version: 'technical-dialogue-v1', ordering: 'score_sorted_conditional', periodStart: '2026-07-27', coverage: { total: 0, measured: 0, excluded: 0, failed: 0 }, sources: [], observations: [], overall: null, baseline: null, recent: null, weeks: Array.from({ length: 8 }, (_, index) => ({ index, start: new Date(Date.UTC(2026, 6, 27 + index * 7)).toISOString().slice(0, 10), end: new Date(Date.UTC(2026, 6, 33 + index * 7)).toISOString().slice(0, 10), sourceIds: [], measures: null })) } }
}
const measured = { scores: { repetition: 0, correction: 0, complaint: 0, speechDensity: 50 }, index: 7.5, rates: { repetition: 0, correction: 0, complaint: 0 }, durationSeconds: 120, speechSeconds: 60, words: 100, counts: { clarification: 0, repeat_request: 0, self_correction: 0, explicit_complaint: 0, escalation_request: 0 } }
test('technical response preserves explicit empty, missing weeks and measured zeroes', () => {
  assert.deepEqual(parseTechnicalResponse({ state: 'empty', dataset: null }), { state: 'empty', dataset: null })
  assert.equal(parseTechnicalResponse(fixture()).dataset.overall, null)
  const response = fixture(), d = response.dataset, id = 'a'.repeat(64)
  d.coverage = { total: 1, measured: 1, excluded: 0, failed: 0 }
  d.sources = [{ id, status: 'measured', reason: null, week: 0, index: 7.5 }]
  d.weeks[0].sourceIds = [id]; d.weeks[0].measures = measured
  d.overall = measured; d.baseline = measured
  const parsed = parseTechnicalResponse(response)
  assert.equal(parsed.dataset.weeks[0].measures.scores.repetition, 0)
  assert.equal(parsed.dataset.weeks[1].measures, null)
  assert.equal(parsed.dataset.overall.index, 7.5)
})
test('technical parser rejects authored payloads, missing measurements, invalid chronology and coverage', () => {
  for (const mutate of [d => d.version = 'authored_scenario', d => d.ordering = 'real_employee_history', d => d.coverage.total = 4, d => d.weeks.pop(), d => d.weeks[0].start = '2026-02-31', d => d.weeks[0].measures = measured, d => d.overall = measured, d => d.observations = [{ sourceId: 'b'.repeat(64), kind: 'clarification', segmentId: '1', quote: 'Уточните', startMs: 0, endMs: 1000 }]]) {
    const response = fixture(); mutate(response.dataset); assert.throws(() => parseTechnicalResponse(response))
  }
})
test('four technical charts have documented scales and no worker psychological assessment', () => {
  assert.deepEqual(technicalCharts.map(c => c.key), ['repetition', 'correction', 'complaint', 'speechDensity'])
  for (const chart of technicalCharts) { assert.match(chart.description, /Выше/); assert.ok(chart.help.length > 50); assert.doesNotMatch(chart.label, /Истощение|Ментальная|Стресс|Выгорание/) }
})
test('missing comparison periods and excluded sources cannot carry measured scores', () => {
  const response = fixture()
  response.dataset.baseline = measured
  assert.throws(() => parseTechnicalResponse(response))
  response.dataset.baseline = null
  response.dataset.coverage = { total: 1, measured: 0, excluded: 1, failed: 0 }
  response.dataset.sources = [{ id: 'a'.repeat(64), status: 'excluded', reason: 'monologue', week: 0, index: 10 }]
  assert.throws(() => parseTechnicalResponse(response))
  response.dataset.sources[0].week = null; response.dataset.sources[0].index = null
  assert.equal(parseTechnicalResponse(response).dataset.coverage.excluded, 1)
})
test('report UI renders calculated values without obsolete technical panels or overall index', async () => {
  const view = await readFile(new URL('../src/views/BurnoutView.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(view, /burnoutDemoData|analysis\.decision|analysis\.metrics|analysis\.workload/)
  assert.doesNotMatch(view, /data\.overall\.index|data\.observations|Основания расчёта|Фрагменты расшифровок/)
  assert.match(view, /getConversationReport/)
  assert.match(view, /reportSeries\(data.value\)/)
  assert.match(view, /Контекст нагрузки/)
  assert.match(view, /Рекомендации/)
})
