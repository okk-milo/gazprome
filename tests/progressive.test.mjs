import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

test('transcript does not wait for the first assessment, final factors wait for completion', () => {
  assert.match(app, /<template v-if="activeCall">/)
  assert.match(app, /<section v-if="activeCall.transcript.length" class="analysis-grid"/)
  assert.match(app, /v-if="activeCall.state === 'completed' && activeCall.analysis" class="factors-column"/)
  assert.doesNotMatch(app, /<template v-if="activeCall\?\.analysis">/)
  assert.match(app, /Текст и роли уточняются/)
})

test('step, history count, risk and upload quantity have explicit labels', () => {
  assert.match(app, /status-hint upload-step"><span>01<\/span>/)
  assert.match(app, /class="status-hint"><span>02<\/span>/)
  assert.doesNotMatch(app, /Шаг 1 из 2/)
  assert.match(app, /Всего проверок: {{ historyTotal }}/)
  assert.match(app, /class="history-score"><small>Риск<\/small>/)
  assert.match(app, /Один файл за загрузку · MP3, WAV, M4A/)
})
