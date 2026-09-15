import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

test('each factor list has a neutral, progress-aware empty state', () => {
  for (const [field, title] of [['factorsFor', 'for-title'], ['factorsAgainst', 'against-title']]) {
    const card = app.match(new RegExp(`<article[^>]+aria-labelledby="${title}"[\\s\\S]*?</article>`))?.[0]
    assert.ok(card)
    assert.ok(card.includes(`v-else-if="activeCall?.analysis?.${field}.length"`))
    assert.match(card, /<AnalysisPlaceholder v-if="!hasFinalAnalysis"/)
    assert.match(card, /<div v-else class="factor-empty">/)
    assert.match(card, /не выявлены<\/strong>/)
    assert.match(card, /В разговоре/)
  }
  assert.match(css, /\.factors-column\s*\{[^}]*flex-direction:\s*column/)
})

test('history reserves the same sufficient status width at desktop and compact breakpoints', () => {
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) 172px 72px 126px/)
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.history-list button\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) 126px/)
  assert.match(css, /\.history-state\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/)
})

test('processing copy keeps progress without exposing the polling interval', () => {
  assert.ok(app.includes('`Выполнено ${activeCall.value.progress}%.`'))
  assert.doesNotMatch(app, /Обновляем данные каждые/)
  assert.match(app, /setInterval\(/)
})
