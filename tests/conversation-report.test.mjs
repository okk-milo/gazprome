import assert from 'node:assert/strict'
import test from 'node:test'
import { chartMaximum, comparison, parseReportResponse, reportSeries } from '../src/services/conversation-report.ts'
import { chartValue } from '../src/services/trajectory.ts'
function fixture() {
  const m = { calls: 1, totalMinutes: 2, repetitionCount: 0, longPauseCount: 1, values: { repetition: 0, speechRate: 180, longPauses: 10, duration: 2 } }
  const w = { calls: 1, minutes: 2, gapMinutes: null, latePercent: 0 }
  return { state: 'ready', dataset: { version: 'conversation-report-v2', coverage: { total: 9, measured: 8 },
    weeks: Array.from({ length: 8 }, (_, index) => ({ index, start: new Date(Date.UTC(2026, 6, 27 + index * 7)).toISOString().slice(0, 10), end: new Date(Date.UTC(2026, 6, 33 + index * 7)).toISOString().slice(0, 10), measures: structuredClone(m), workload: structuredClone(w) })),
    overall: { ...m, calls: 8, totalMinutes: 16 }, baseline: { ...m, calls: 2 }, recent: { ...m, calls: 2 },
    workload: { ...w, calls: 8 }, baselineWorkload: { ...w, calls: 2 }, recentWorkload: { ...w, calls: 2 },
  } }
}
test('report parser preserves measured zero, null gaps, units and comparison periods', () => {
  const r = parseReportResponse(fixture())
  assert.equal(r.dataset.overall.values.repetition, 0)
  assert.equal(r.dataset.workload.gapMinutes, null)
  assert.equal(comparison(r.dataset, 'speechRate'), 'Без изменений')
  assert.deepEqual(parseReportResponse({ state: 'empty', dataset: null }), { state: 'empty', dataset: null })
})
test('invalid reports are errors, not empty successful charts', () => {
  for (const mutate of [d => d.version = 'old', d => d.coverage.measured = 10, d => d.weeks.pop(), d => d.weeks[1].start = '2026-02-31', d => d.overall.values.longPauses = 101, d => d.baseline = null, d => d.recentWorkload = null, d => d.weeks[0].measures = null]) {
    const r = fixture(); mutate(r.dataset); assert.throws(() => parseReportResponse(r))
  }
})
test('native chart units do not clip 180 words/min to a fake 100-point score', () => {
  const series = reportSeries(parseReportResponse(fixture()).dataset)
  const tempo = series.find(c => c.key === 'speechRate')
  assert.equal(tempo.max, 200)
  assert.equal(tempo.unit, 'слов/мин')
  assert.equal(chartValue(tempo.values, 0, tempo.max), 180)
  assert.equal(series.find(c => c.key === 'longPauses').max, 100)
  assert.equal(chartMaximum([0, null]), 1)
  assert.equal(chartMaximum([0.15, 0.9]), 1)
  assert.equal(chartMaximum([7.5]), 10)
})
