import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { compile } from '@vue/compiler-dom'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'

test('timeline reserves desktop/mobile slots without fabricating points and expands for longer histories', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const match = app.match(/<div v-if="timelinePoints.length"[^\n]+/)
  assert.ok(match, 'Timeline markup exists in the application')
  const { code } = compile(match[0], { mode: 'function', prefixIdentifiers: true })
  const render = new Function('Vue', code)(Vue)
  for (const count of [1, 2, 8, 24]) {
    const timelinePoints = Array.from({ length: count }, (_, index) => ({ timestampMs: (index + 1) * 10000, score: index === 0 ? 0 : 20 }))
    const html = await renderToString(Vue.createSSRApp({ render, setup: () => ({ timelinePoints, formatTime: value => String(value) }) }))
    assert.match(html, new RegExp(`--timeline-columns:${Math.max(8, count)}`))
    assert.match(html, new RegExp(`--timeline-compact-columns:${Math.max(4, count)}`))
    assert.equal((html.match(/class="timeline-point"/g) ?? []).length, count)
    assert.equal((html.match(/<time>/g) ?? []).length, count)
    assert.match(html, /height:0%/)
  }
  assert.match(css, /\.timeline\s*\{[^}]*display: grid;[^}]*grid-template-columns: repeat\(var\(--timeline-columns, 8\), minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(max-width: 560px\)\s*\{\s*\.timeline\s*\{\s*grid-template-columns: repeat\(var\(--timeline-compact-columns, 4\), minmax\(0, 1fr\)\)/)
})

test('percentage bars have a fixed-height track and errors do not demand reupload', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(app, /class="timeline-track"><div class="timeline-bar"/)
  assert.match(css, /\.timeline-track\s*\{\s*height:\s*160px/)
  assert.doesNotMatch(app, /Требуется повторная загрузка/)
})

test('transcript sides follow identified roles, not odd/even positions', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(app, /'transcript-message--client': segment\.speaker === 'Клиент'/)
  assert.match(app, /'transcript-message--unknown': !\['Клиент', 'Оператор'\]\.includes\(segment\.speaker\)/)
  assert.match(css, /\.transcript-message--client\s*\{\s*align-self:\s*end/)
  assert.doesNotMatch(css, /\.transcript-message:nth-child/)
})

test('operator speech is rendered without highlights even when the API supplies evidence ranges', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /if \(segment\.speaker === 'Оператор'\) return \[\{ text: segment\.text, highlighted: false \}\][\s\S]*const range = segment\.highlightRanges\[0\]/)
})
