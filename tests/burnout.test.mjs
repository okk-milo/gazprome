import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import postcss from 'postcss'
import { burnoutDemoData } from '../src/data/burnout.ts'
import { pageFromHash } from '../src/navigation.ts'

test('burnout deep link and antifraud/default hashes resolve to separate pages', () => {
  assert.equal(pageFromHash('#burnout'), 'burnout')
  for (const hash of ['', '#antifraud', '#unknown']) assert.equal(pageFromHash(hash), 'antifraud')
})

test('restored burnout fixture retains the old example and eight weeks of data', () => {
  assert.equal(burnoutDemoData.context[0].value, 'Дмитрий С.')
  assert.equal(burnoutDemoData.decision.result.score, 64)
  assert.equal(burnoutDemoData.trajectory.xAxisLabels.length, 8)
  assert.equal(burnoutDemoData.trajectory.series.length, 4)
  for (const series of burnoutDemoData.trajectory.series) {
    assert.equal(series.values.length, 8)
    assert.ok(series.values.every(value => value >= 0 && value <= 100))
  }
  assert.equal(burnoutDemoData.metrics.length, 4)
  assert.equal(burnoutDemoData.workload.length, 4)
  assert.equal(burnoutDemoData.evidence.length, 3)
  assert.equal(burnoutDemoData.actions.length, 3)
})

test('burnout is explicitly demo-only and does not call analysis APIs or start polling', async () => {
  const view = await readFile(new URL('../src/views/BurnoutView.vue', import.meta.url), 'utf8')
  assert.match(view, /Демонстрационные данные/)
  assert.match(view, /Не связан с загруженными звонками/)
  assert.doesNotMatch(view, /fetch\(|services\/|setInterval|setTimeout|burnoutAnalysisId/)
})

test('navigation preserves the antifraud tree and loads its data only when opened', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /v-show="activePage === 'antifraud'"/)
  assert.match(app, /if \(activePage\.value === 'antifraud'\) void initializeAntifraud\(\)/)
  assert.match(app, /if \(antifraudInitialized\) return/)
  assert.match(app, /addEventListener\('hashchange', syncPageWithHash\)/)
  assert.match(app, /removeEventListener\('hashchange', syncPageWithHash\)/)
  assert.match(app, /href="#burnout" :aria-current=/)
})

test('restored burnout styles cannot override the antifraud page', async () => {
  const css = await readFile(new URL('../src/burnout.css', import.meta.url), 'utf8')
  postcss.parse(css).walkRules(rule => {
    assert.ok(rule.selectors.every(selector => /^\.burnout-demo(?:\b|__)/.test(selector)), rule.selector)
  })
})
