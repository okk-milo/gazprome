<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  createEmployee,
  createUpload,
  getCallSnapshot,
  listDeals,
  listEmployees,
  markUploaded,
  type CallSnapshot,
  type Deal,
  type Employee,
  type TranscriptSegment,
} from './services/gazprom-api'

const employees = ref<Employee[]>([])
const deals = ref<Deal[]>([])
const selectedEmployeeId = ref('')
const selectedDealId = ref('')
const selectedFile = ref<File | null>(null)
const activeCall = ref<CallSnapshot | null>(null)
const isLoading = ref(true)
const isUploading = ref(false)
const errorMessage = ref<string | null>(null)
let pollingTimer: ReturnType<typeof setInterval> | null = null

const riskScore = computed(() => activeCall.value?.analysis?.score ?? null)
const processingLabel = computed(() => {
  const state = activeCall.value?.state
  if (state === 'transcribing') return 'Расшифровываем запись'
  if (state === 'analysing') return 'Оцениваем риск мошенничества'
  if (state === 'uploaded') return 'Звонок ожидает обработки'
  if (state === 'completed') return 'Анализ завершён'
  if (state === 'failed') return 'Не удалось обработать звонок'
  return 'Выберите запись для анализа'
})

onMounted(async () => {
  try {
    employees.value = await listEmployees()
    deals.value = await listDeals()
    selectedEmployeeId.value = employees.value[0]?.id ?? ''
    selectedDealId.value = deals.value[0]?.id ?? ''
  } catch (error: unknown) {
    errorMessage.value = readError(error)
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(stopPolling)

function onFileChange(event: Event): void {
  const input = event.target
  if (input instanceof HTMLInputElement) selectedFile.value = input.files?.[0] ?? null
}

async function addEmployee(): Promise<void> {
  try {
    const employee = await createEmployee()
    employees.value = [...employees.value, employee]
    selectedEmployeeId.value = employee.id
  } catch (error: unknown) {
    errorMessage.value = readError(error)
  }
}

async function uploadCall(): Promise<void> {
  const file = selectedFile.value
  if (!file || !selectedEmployeeId.value || !selectedDealId.value) {
    errorMessage.value = 'Выберите сотрудника, сделку и аудиозапись.'
    return
  }

  errorMessage.value = null
  isUploading.value = true
  try {
    const upload = await createUpload(selectedDealId.value, selectedEmployeeId.value, file)
    if (upload.uploadUrl) {
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'audio/mpeg' },
        body: file,
      })
      if (!response.ok) throw new Error(`Не удалось загрузить запись: HTTP ${response.status}`)
    }
    activeCall.value = await markUploaded(upload.call.id)
    selectedFile.value = null
    startPolling()
  } catch (error: unknown) {
    errorMessage.value = readError(error)
  } finally {
    isUploading.value = false
  }
}

function startPolling(): void {
  stopPolling()
  pollingTimer = setInterval(() => void refreshSnapshot(), 3000)
}

function stopPolling(): void {
  if (pollingTimer) clearInterval(pollingTimer)
  pollingTimer = null
}

async function refreshSnapshot(): Promise<void> {
  const call = activeCall.value
  if (!call || call.state === 'completed' || call.state === 'failed') {
    stopPolling()
    return
  }
  try {
    activeCall.value = await getCallSnapshot(call.id)
  } catch (error: unknown) {
    errorMessage.value = readError(error)
    stopPolling()
  }
}

function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function highlightPieces(segment: TranscriptSegment): Array<{ text: string; highlighted: boolean }> {
  const range = segment.highlightRanges[0]
  if (!range) return [{ text: segment.text, highlighted: false }]
  return [
    { text: segment.text.slice(0, range.startOffset), highlighted: false },
    { text: segment.text.slice(range.startOffset, range.endOffset), highlighted: true },
    { text: segment.text.slice(range.endOffset), highlighted: false },
  ].filter((piece) => piece.text.length > 0)
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос.'
}
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
      <div><p class="eyebrow">Антифрод · анализ звонков</p><h1>Оценка риска воздействия мошенников</h1></div>
    </header>

    <section class="upload-card" aria-labelledby="upload-title">
      <div><h2 id="upload-title">Загрузить звонок</h2><p>Запись будет связана с выбранной сделкой и обработана в защищённом контуре.</p></div>
      <div class="upload-grid">
        <label><span>Сотрудник</span><select v-model="selectedEmployeeId" :disabled="isLoading || isUploading"><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option></select></label>
        <button class="secondary-button" type="button" :disabled="isLoading || isUploading" @click="addEmployee">Новый сотрудник</button>
        <label><span>Сделка</span><select v-model="selectedDealId" :disabled="isLoading || isUploading"><option v-for="deal in deals" :key="deal.id" :value="deal.id">{{ deal.title }}</option></select></label>
        <label class="file-input"><span>Аудиозапись</span><input accept="audio/*" type="file" :disabled="isUploading" @change="onFileChange" /><small>{{ selectedFile?.name ?? 'Файл не выбран' }}</small></label>
        <button class="primary-button" type="button" :disabled="isLoading || isUploading" @click="uploadCall">{{ isUploading ? 'Загружаем…' : 'Запустить анализ' }}</button>
      </div>
    </section>

    <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
    <section class="status-card" :class="{ 'status-card--complete': activeCall?.state === 'completed' }" aria-live="polite">
      <div><p class="eyebrow">Состояние анализа</p><h2>{{ processingLabel }}</h2><p v-if="activeCall && activeCall.state !== 'completed'" class="progress-copy">Выполнено {{ activeCall.progress }}%. Интерфейс обновляется каждые 3 секунды.</p></div>
      <div class="score"><strong>{{ riskScore ?? '—' }}</strong><span>из 100</span></div>
    </section>

    <template v-if="activeCall?.analysis">
      <section class="card" aria-labelledby="timeline-title">
        <div class="card-heading"><div><p class="eyebrow">Динамика</p><h2 id="timeline-title">Уверенность по ходу разговора</h2></div><span class="model-label">{{ activeCall.analysis.modelVersion }}</span></div>
        <div class="timeline" role="img" aria-label="График оценки риска"><div v-for="point in activeCall.analysis.timeline" :key="point.timestampMs" class="timeline-point"><div class="timeline-value">{{ point.score }}</div><div class="timeline-bar" :style="{ height: `${point.score}%` }"></div><time>{{ formatTime(point.timestampMs) }}</time></div></div>
      </section>

      <section class="analysis-grid">
        <article class="card" aria-labelledby="transcript-title"><div class="card-heading"><div><p class="eyebrow">Расшифровка</p><h2 id="transcript-title">Беседа</h2></div></div><ol class="transcript-list"><li v-for="segment in activeCall.transcript" :key="segment.id" class="transcript-message"><div><strong>{{ segment.speaker }}</strong><time>{{ formatTime(segment.startMs) }}</time></div><p><template v-for="(piece, index) in highlightPieces(segment)" :key="index"><mark v-if="piece.highlighted">{{ piece.text }}</mark><template v-else>{{ piece.text }}</template></template></p></li></ol></article>
        <div class="factors-column">
          <article class="card factor-card" aria-labelledby="for-title"><div class="card-heading"><div><p class="eyebrow">Основания</p><h2 id="for-title">Что говорит за риск</h2></div></div><ul class="factor-list"><li v-for="factor in activeCall.analysis.factorsFor" :key="factor.id"><strong>{{ factor.title }}</strong><p>{{ factor.description }}</p><span>{{ Math.round(factor.confidence * 100) }}%</span></li></ul></article>
          <article class="card factor-card factor-card--against" aria-labelledby="against-title"><div class="card-heading"><div><p class="eyebrow">Проверка</p><h2 id="against-title">Что снижает риск</h2></div></div><ul class="factor-list"><li v-for="factor in activeCall.analysis.factorsAgainst" :key="factor.id"><strong>{{ factor.title }}</strong><p>{{ factor.description }}</p><span>{{ Math.round(factor.confidence * 100) }}%</span></li></ul></article>
        </div>
      </section>
    </template>
  </main>
</template>
