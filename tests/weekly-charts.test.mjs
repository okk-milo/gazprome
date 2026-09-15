import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { burnoutDemoData } from '../src/data/burnout.ts'
import { adverseScore, chartValue, scenarioSeries } from '../src/services/trajectory.ts'

test('all four chart labels and directions express more adverse values upwards', () => {
  const series = burnoutDemoData.trajectory.series
  assert.deepEqual(series.map(item => item.label), ['Истощение', 'Ментальная дистанция', 'Несогласованность речи', 'Интенсивность нагрузки'])
  for (const item of series) {
    assert.equal(item.direction, 'higher-is-worse')
    assert.match(item.description, /Выше/)
    assert.equal(item.values.length, 8)
  }
})

test('positive source measurements are inverted, adverse measurements are preserved', () => {
  assert.equal(adverseScore(82, 'positive'), 18)
  assert.equal(adverseScore(82, 'adverse'), 82)
  for (const value of [NaN, Infinity, -1, 101]) assert.throws(() => adverseScore(value, 'positive'), RangeError)
})

test('missing or invalid weekly readings are not displayed as a reassuring zero', () => {
  assert.equal(chartValue([0], 0), 0)
  assert.equal(chartValue([100], 0), 100)
  for (const values of [[], [NaN], [Infinity], [-1], [101]]) assert.equal(chartValue(values, 0), null)
})

test('sample coverage and baseline copy no longer assert invented sufficiency or sigma', () => {
  const context = JSON.stringify(burnoutDemoData.context)
  assert.doesNotMatch(context, /187|σ|достаточно для недельной оценки/)
})

test('API scores bind by metric key rather than display order or mock values', () => {
  const result = scenarioSeries(burnoutDemoData.trajectory.series.toReversed(), [{exhaustion:1,distance:2,speechInconsistency:3,workload:4}])
  assert.deepEqual(result.map(item => item.values), [[4],[3],[2],[1]])
  assert.throws(() => scenarioSeries([{...burnoutDemoData.trajectory.series[0], key:'absent'}], []))
})

test('chart help uses named info buttons and a native modal instead of inline disclosures', async () => {
  const component = await readFile(new URL('../src/components/PeriodComparison.vue', import.meta.url), 'utf8')
  assert.match(component, /class="weekly-chart__header"/)
  assert.match(component, /class="weekly-chart__info"[^>]*:aria-label=[^>]*aria-haspopup="dialog"/)
  assert.match(component, /<dialog[^>]*aria-labelledby="weekly-chart-help-title"[^>]*aria-describedby="weekly-chart-help-description"/)
  assert.match(component, /\.showModal\(\)/)
  assert.match(component, /@close="selectedChart = null"/)
  assert.match(component, /aria-label="Закрыть пояснение" autofocus/)
  assert.match(component, /onBeforeUnmount\(closeHelp\)/)
  assert.match(component, /@keydown.tab="keepFocusInDialog"/)
  assert.match(component, /selectedChart.description/)
  assert.doesNotMatch(component, /<details|<summary|На всех графиках:/)
})

test('removing dataset metadata retains deliberate chart loading, empty and error states', async () => {
  const view = await readFile(new URL('../src/views/BurnoutView.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(view, /BurnoutDatasetCoverage|Начало сценария:|Состав по неделям|Записи для сценария/)
  assert.match(view, /result.state === 'loading'/)
  assert.match(view, /result.state === 'empty'/)
  assert.match(view, /Не удалось загрузить графики/)
  assert.match(view, /@click="load">Повторить/)
  assert.match(view, /<PeriodComparison v-if="result.state === 'ready'"/)
  assert.match(view, /Примеры из расшифровок/)
})
