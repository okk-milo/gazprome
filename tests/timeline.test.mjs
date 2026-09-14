import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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
