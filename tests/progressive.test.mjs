import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

test('all four result cards stay mounted, only their placeholders and data change', () => {
  assert.match(app, /<section class="card timeline-card" aria-labelledby="timeline-title">/)
  assert.match(app, /<section class="analysis-grid">/)
  assert.match(app, /<div class="factors-column">/)
  assert.doesNotMatch(app, /<template v-if="activeCall|analysis-grid--preview/)
  assert.match(app, /<AnalysisPlaceholder v-else kind="timeline"/)
  assert.match(app, /<AnalysisPlaceholder kind="transcript"/)
  assert.equal(app.match(/<AnalysisPlaceholder v-if="!hasFinalAnalysis" kind="factors"/g)?.length, 2)
})

test('raw speaker identifiers are not rendered and transcript scrolling respects the reader', () => {
  assert.match(app, /<strong v-if="speakerLabel\(segment.speaker\)">/)
  assert.doesNotMatch(app, /<strong>{{ segment.speaker }}<\/strong>/)
  assert.match(app, /@scroll.passive="updateTranscriptFollowing"/)
  assert.match(app, /scrollHeight - element.clientHeight - element.scrollTop <= 32/)
  assert.match(app, /element.scrollTop = followTranscript \? element.scrollHeight : previousTop/)
  assert.match(app, /await nextTick\(\)/)
  assert.match(app, /if \(page !== 'antifraud'\) return/)
  assert.match(app, /transcriptScrollTop = element.scrollTop/)
})

test('step, history count, risk and upload quantity have explicit labels', () => {
  assert.match(app, /status-hint upload-step"><span>01<\/span>/)
  assert.match(app, /class="status-hint"><span>02<\/span>/)
  assert.doesNotMatch(app, /Шаг 1 из 2/)
  assert.match(app, /Всего проверок: {{ historyTotal }}/)
  assert.match(app, /class="history-score"><small>Риск<\/small>/)
  assert.match(app, /Один файл за загрузку · MP3, WAV, M4A/)
})
