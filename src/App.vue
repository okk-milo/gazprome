<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { pageFromHash } from './navigation'
import BurnoutView from './views/BurnoutView.vue'
import {
  createEmployee,
  createUpload,
  deleteEmployee,
  getCallSnapshot,
  listCallHistory,
  listDeals,
  listEmployees,
  markUploaded,
  type CallHistoryItem,
  type CallHistoryPage,
  type CallSnapshot,
  type Deal,
  type Employee,
  type TranscriptSegment,
} from './services/gazprom-api'

interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

type TimelinePoint = NonNullable<CallSnapshot['analysis']>['timeline'][number]

const TIMELINE_POINT_LIMIT = 24

const activePage = ref(pageFromHash(window.location.hash))
let antifraudInitialized = false

function syncPageWithHash(): void {
  activePage.value = pageFromHash(window.location.hash)
  document.title = activePage.value === 'burnout' ? 'Выгорание — демонстрация | OKK' : 'Антифрод | OKK'
  if (activePage.value === 'antifraud') void initializeAntifraud()
}

const employees = ref<Employee[]>([])
const deals = ref<Deal[]>([])
const selectedEmployeeId = ref('')
const selectedDealId = ref('')
const selectedFile = ref<File | null>(null)
const activeCall = ref<CallSnapshot | null>(null)
const callHistory = ref<CallHistoryItem[]>([])
const historyPage = ref(1)
const historyPageSize = ref(5)
const historyTotal = ref(0)
const isLoading = ref(true)
const isUploading = ref(false)
const isDeletingEmployee = ref(false)
const isFileDragging = ref(false)
const toasts = ref<Toast[]>([])
let pollingTimer: ReturnType<typeof setInterval> | null = null
let nextToastId = 0
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()

const riskScore = computed(() => activeCall.value?.analysis?.score ?? null)
const historyPageCount = computed(() => Math.max(1, Math.ceil(historyTotal.value / historyPageSize.value)))
const timelinePoints = computed<TimelinePoint[]>(() => {
  const timeline = activeCall.value?.analysis?.timeline ?? []
  if (timeline.length <= TIMELINE_POINT_LIMIT) return timeline

  const sampled: TimelinePoint[] = []
  const lastIndex = timeline.length - 1
  for (let index = 0; index < TIMELINE_POINT_LIMIT; index += 1) {
    const point = timeline[Math.round((index * lastIndex) / (TIMELINE_POINT_LIMIT - 1))]
    if (point) sampled.push(point)
  }
  return sampled
})
const isTerminalCall = computed(() => {
  const state = activeCall.value?.state
  return state === 'completed' || state === 'no_speech' || state === 'failed'
})
const processingLabel = computed(() => {
  const state = activeCall.value?.state
  if (state === 'transcribing') return 'Расшифровываем запись'
  if (state === 'analysing') return 'Оцениваем риск мошенничества'
  if (state === 'uploaded') return 'Звонок ожидает обработки'
  if (state === 'completed') return 'Анализ завершён'
  if (state === 'no_speech') return 'В записи не распознана речь'
  if (state === 'failed') return 'Не удалось обработать звонок'
  return 'Выберите запись для анализа'
})
const processingDescription = computed(() => {
  const state = activeCall.value?.state
  if (state === 'no_speech') return 'Оценка риска не сформирована. Проверьте звук или выберите другую запись.'
  if (state === 'failed') return 'Обработка прервана. Сообщите администратору об этой проверке.'
  if (state === 'completed') return ''
  if (activeCall.value) return `Выполнено ${activeCall.value.progress}%.`
  return 'Здесь появятся оценка риска, ключевые фразы и основания решения.'
})

onMounted(() => {
  window.addEventListener('hashchange', syncPageWithHash)
  syncPageWithHash()
})

async function initializeAntifraud(): Promise<void> {
  if (antifraudInitialized) return
  antifraudInitialized = true
  try {
    const [loadedEmployees, loadedDeals, loadedHistory] = await Promise.all([
      listEmployees(),
      listDeals(),
      listCallHistory(1),
    ])
    employees.value = loadedEmployees
    deals.value = loadedDeals
    applyHistoryPage(loadedHistory)
    selectedEmployeeId.value = employees.value[0]?.id ?? ''
    selectedDealId.value = deals.value[0]?.id ?? ''
  } catch (error: unknown) {
    showError(error)
  } finally {
    isLoading.value = false
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncPageWithHash)
  stopPolling()
  toastTimers.forEach((timer) => clearTimeout(timer))
})

function onFileChange(event: Event): void {
  const input = event.target
  setSelectedFile(input instanceof HTMLInputElement ? (input.files?.[0] ?? null) : null)
}

function onFileDrop(event: DragEvent): void {
  event.preventDefault()
  isFileDragging.value = false
  setSelectedFile(event.dataTransfer?.files[0] ?? null)
}

function setSelectedFile(file: File | null): void {
  if (!file) return

  if (file.type && !file.type.startsWith('audio/')) {
    showToast('error', 'Для анализа подходит аудиофайл.')
    return
  }

  selectedFile.value = file
}

async function addEmployee(): Promise<void> {
  try {
    const employee = await createEmployee()
    employees.value = [...employees.value, employee]
    selectedEmployeeId.value = employee.id
    showToast('success', 'Сотрудник добавлен.')
  } catch (error: unknown) {
    showError(error)
  }
}

async function removeEmployee(): Promise<void> {
  const employeeId = selectedEmployeeId.value
  if (!employeeId || isDeletingEmployee.value) return

  isDeletingEmployee.value = true
  try {
    await deleteEmployee(employeeId)
    employees.value = employees.value.filter((employee) => employee.id !== employeeId)
    selectedEmployeeId.value = employees.value[0]?.id ?? ''
    showToast('success', 'Сотрудник удалён.')
  } catch (error: unknown) {
    showError(error)
  } finally {
    isDeletingEmployee.value = false
  }
}

async function uploadCall(): Promise<void> {
  const file = selectedFile.value
  if (!file || !selectedEmployeeId.value || !selectedDealId.value) {
    showToast('error', 'Выберите сотрудника, сделку и аудиозапись.')
    return
  }

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
    await loadCallHistory(1)
    selectedFile.value = null
    startPolling()
    showToast('success', 'Аудиозапись загружена. Начинаем анализ.')
  } catch (error: unknown) {
    showError(error)
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
  if (!call || isTerminalCall.value) {
    stopPolling()
    return
  }
  try {
    const snapshot = await getCallSnapshot(call.id)
    activeCall.value = snapshot
    syncHistorySnapshot(snapshot)
    if (snapshot.state === 'completed') {
      stopPolling()
      showToast('success', 'Анализ звонка завершён.')
    }
    if (snapshot.state === 'no_speech') {
      stopPolling()
      showToast('info', 'В записи не распознана речь. Оценка риска не сформирована.')
    }
    if (snapshot.state === 'failed') {
      stopPolling()
      showToast('error', 'Не удалось обработать запись.')
    }
  } catch (error: unknown) {
    showError(error)
    stopPolling()
  }
}

async function loadCallHistory(page = historyPage.value): Promise<void> {
  applyHistoryPage(await listCallHistory(page))
}

async function changeHistoryPage(page: number): Promise<void> {
  if (page < 1 || page > historyPageCount.value || page === historyPage.value) return
  try {
    await loadCallHistory(page)
  } catch (error: unknown) {
    showError(error)
  }
}

function applyHistoryPage(history: CallHistoryPage): void {
  callHistory.value = history.items
  historyPage.value = history.page
  historyPageSize.value = history.pageSize
  historyTotal.value = history.total
}

async function openHistoryCall(callId: string): Promise<void> {
  try {
    activeCall.value = await getCallSnapshot(callId)
    if (isTerminalCall.value) {
      stopPolling()
    } else {
      startPolling()
    }
  } catch (error: unknown) {
    showError(error)
  }
}

function syncHistorySnapshot(snapshot: CallSnapshot): void {
  callHistory.value = callHistory.value.map((item) =>
    item.id === snapshot.id
      ? { ...item, state: snapshot.state, progress: snapshot.progress, score: snapshot.analysis?.score ?? null }
      : item,
  )
}

function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function callStateLabel(state: CallHistoryItem['state']): string {
  if (state === 'completed') return 'Готово'
  if (state === 'no_speech') return 'Нет речи'
  if (state === 'failed') return 'Ошибка'
  if (state === 'analysing') return 'Оцениваем'
  if (state === 'transcribing') return 'Расшифровываем'
  return 'В очереди'
}

function highlightPieces(segment: TranscriptSegment): Array<{ text: string; highlighted: boolean }> {
  if (segment.speaker === 'Оператор') return [{ text: segment.text, highlighted: false }]
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

function showError(error: unknown): void {
  showToast('error', readError(error))
}

function showToast(kind: Toast['kind'], message: string): void {
  const id = nextToastId
  nextToastId += 1
  toasts.value = [...toasts.value, { id, kind, message }]
  toastTimers.set(id, setTimeout(() => dismissToast(id), 5000))
}

function dismissToast(id: number): void {
  const timer = toastTimers.get(id)
  if (timer) clearTimeout(timer)
  toastTimers.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}
</script>

<template>
  <Teleport to="body">
    <ol v-if="toasts.length" class="toast-stack" aria-live="polite" aria-relevant="additions">
      <li v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast--${toast.kind}`" :role="toast.kind === 'error' ? 'alert' : 'status'">
        <span class="toast-icon" aria-hidden="true">
          <svg v-if="toast.kind === 'success'" viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7" /></svg>
          <svg v-else-if="toast.kind === 'info'" viewBox="0 0 24 24"><path d="M12 11v5m0-9h.01" /><circle cx="12" cy="12" r="9" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01M12 3 3.8 18a2 2 0 0 0 1.76 3h12.88a2 2 0 0 0 1.76-3L12 3Z" /></svg>
        </span>
        <p>{{ toast.message }}</p>
        <button type="button" aria-label="Закрыть уведомление" @click="dismissToast(toast.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg></button>
      </li>
    </ol>
  </Teleport>

  <main class="app-shell">
    <header class="app-header">
      <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="header-copy">
        <p class="eyebrow">{{ activePage === 'burnout' ? 'Благополучие сотрудников · линия поддержки' : 'Антифрод · анализ звонков' }}</p>
        <h1>{{ activePage === 'burnout' ? 'Состояние сотрудника' : 'Оценка риска воздействия мошенников' }}</h1>
      </div>
    </header>

    <nav class="page-switcher" aria-label="Разделы анализа">
      <a href="#antifraud" :aria-current="activePage === 'antifraud' ? 'page' : undefined">Антифрод</a>
      <a href="#burnout" :aria-current="activePage === 'burnout' ? 'page' : undefined">Выгорание</a>
    </nav>

    <section v-show="activePage === 'antifraud'" aria-label="Анализ звонков">

    <section class="upload-card" aria-labelledby="upload-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Новая проверка</p>
          <h2 id="upload-title">Загрузить звонок</h2>
          <p>Выберите сотрудника и сделку — результат появится на этой странице.</p>
        </div>
        <span class="step-label">Шаг 1 из 2</span>
      </div>

      <div class="upload-workspace">
        <div class="upload-fields">
          <label class="field-control">
            <span>Сотрудник</span>
            <div class="employee-picker">
              <div class="select-control">
                <select v-model="selectedEmployeeId" :disabled="isLoading || isUploading || isDeletingEmployee">
                  <option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option>
                </select>
                <svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
              </div>
              <button class="remove-employee-button" type="button" title="Удалить выбранного сотрудника" aria-label="Удалить выбранного сотрудника" :disabled="isLoading || isUploading || isDeletingEmployee || !selectedEmployeeId" @click="removeEmployee">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" /></svg>
              </button>
              <button class="add-employee-button" type="button" :disabled="isLoading || isUploading || isDeletingEmployee" @click="addEmployee">
                <span aria-hidden="true">+</span> Новый сотрудник
              </button>
            </div>
          </label>

          <label class="field-control">
            <span>Сделка</span>
            <div class="select-control">
              <select v-model="selectedDealId" :disabled="isLoading || isUploading || isDeletingEmployee">
                <option v-for="deal in deals" :key="deal.id" :value="deal.id">{{ deal.title }}</option>
              </select>
              <svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
            </div>
          </label>
        </div>

        <label
          class="file-dropzone"
          :class="{ 'file-dropzone--active': isFileDragging, 'file-dropzone--selected': selectedFile }"
          @dragenter.prevent="isFileDragging = true"
          @dragover.prevent="isFileDragging = true"
          @dragleave.prevent="isFileDragging = false"
          @drop="onFileDrop"
        >
          <input class="visually-hidden" accept="audio/*" type="file" :disabled="isUploading" @change="onFileChange" />
          <span class="file-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 18V6l9-2v12"/><path d="M9 9l9-2"/><circle cx="6" cy="18" r="3"/><circle cx="15" cy="16" r="3"/></svg>
          </span>
          <span class="file-copy">
            <strong>{{ selectedFile ? selectedFile.name : 'Перетащите аудиозапись сюда' }}</strong>
            <span>{{ selectedFile ? formatFileSize(selectedFile.size) : 'или выберите файл с устройства · MP3, WAV, M4A' }}</span>
          </span>
          <span class="file-action">{{ selectedFile ? 'Изменить' : 'Выбрать файл' }}</span>
        </label>

        <div class="upload-footer">
          <p><svg class="footer-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12m-4-4 4 4-4 4" /></svg> После загрузки расшифровка и оценка появятся автоматически.</p>
          <button class="primary-button" type="button" :disabled="isLoading || isUploading || !selectedFile" @click="uploadCall">
            {{ isUploading ? 'Загружаем…' : 'Запустить анализ' }}
          </button>
        </div>
      </div>
    </section>

    <section class="history-card" aria-labelledby="history-title">
      <div class="history-heading">
        <div><p class="eyebrow">История</p><h2 id="history-title">Предыдущие проверки</h2></div>
        <span v-if="historyTotal" class="history-count">{{ historyTotal }}</span>
      </div>
      <p v-if="!callHistory.length" class="history-empty">Завершённые проверки появятся здесь.</p>
      <ol v-else class="history-list">
        <li v-for="item in callHistory" :key="item.id">
          <button type="button" :class="{ 'history-item--active': activeCall?.id === item.id }" @click="openHistoryCall(item.id)">
            <span class="history-main"><strong>{{ item.fileName }}</strong><span>{{ item.dealTitle }} · {{ item.employeeName }}</span></span>
            <time>{{ formatDate(item.createdAt) }}</time>
            <span v-if="item.score !== null" class="history-score">{{ Math.round(item.score) }}<small>из 100</small></span>
            <span v-else class="history-score history-score--pending">—</span>
            <span class="history-state" :class="`history-state--${item.state}`">{{ callStateLabel(item.state) }}</span>
          </button>
        </li>
      </ol>
      <nav v-if="historyPageCount > 1" class="history-pagination" aria-label="Страницы истории проверок">
        <button type="button" :disabled="historyPage === 1" @click="changeHistoryPage(historyPage - 1)">Назад</button>
        <span>Страница {{ historyPage }} из {{ historyPageCount }}</span>
        <button type="button" :disabled="historyPage === historyPageCount" @click="changeHistoryPage(historyPage + 1)">Далее</button>
      </nav>
    </section>

    <section class="status-card" :class="{ 'status-card--complete': activeCall?.state === 'completed', 'status-card--notice': activeCall?.state === 'no_speech', 'status-card--idle': !activeCall }" aria-live="polite">
      <div class="status-copy">
        <span class="status-icon" :class="{ 'status-icon--complete': activeCall?.state === 'completed', 'status-icon--notice': activeCall?.state === 'no_speech' }" aria-hidden="true">
          <svg v-if="activeCall?.state === 'completed'" viewBox="0 0 24 24" fill="none"><path d="m5 12 4.5 4.5L19 7"/></svg>
          <svg v-else-if="activeCall?.state === 'no_speech'" viewBox="0 0 24 24" fill="none"><path d="M12 11v5m0-9h.01"/><circle cx="12" cy="12" r="9"/></svg>
          <svg v-else-if="activeCall" viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 1 1-6.36 2.64"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none"><path d="M12 3v9l6 3"/><circle cx="12" cy="12" r="9"/></svg>
        </span>
        <div>
          <p class="eyebrow">Состояние анализа</p>
          <h2>{{ processingLabel }}</h2>
          <p v-if="processingDescription" class="progress-copy">{{ processingDescription }}</p>
        </div>
      </div>
      <div v-if="riskScore !== null" class="score-panel">
        <span>Уверенность в риске</span>
        <div><strong>{{ riskScore }}</strong><small>из 100</small></div>
      </div>
      <div v-else-if="activeCall?.state === 'no_speech'" class="score-pending score-pending--notice">Без оценки риска</div>
      <div v-else-if="activeCall?.state === 'failed'" class="score-pending score-pending--error">Анализ прерван</div>
      <div v-else-if="activeCall" class="score-pending"><span class="pulse-dot"></span> Формируем оценку</div>
      <div v-else class="status-hint"><span>02</span><p>Анализ начнётся<br />после загрузки файла</p></div>
    </section>

    <template v-if="activeCall?.analysis">
      <section class="card" aria-labelledby="timeline-title">
        <div class="card-heading"><div><p class="eyebrow">Динамика</p><h2 id="timeline-title">Уверенность по ходу разговора</h2></div></div>
        <p class="timeline-caption">Оценки на конец обработанных фрагментов разговора.</p>
        <div class="timeline" role="img" aria-label="График оценки риска"><div v-for="point in timelinePoints" :key="point.timestampMs" class="timeline-point"><div class="timeline-value">{{ point.score }}</div><div class="timeline-track"><div class="timeline-bar" :style="{ height: `${point.score}%` }"></div></div><time>{{ formatTime(point.timestampMs) }}</time></div></div>
      </section>

      <section class="analysis-grid">
        <article class="card" aria-labelledby="transcript-title">
          <div class="card-heading"><div><p class="eyebrow">Расшифровка</p><h2 id="transcript-title">Беседа</h2></div></div>
          <ol class="transcript-list">
            <li v-for="segment in activeCall.transcript" :key="segment.id" class="transcript-message"
              :class="{ 'transcript-message--client': segment.speaker === 'Клиент', 'transcript-message--unknown': !['Клиент', 'Оператор'].includes(segment.speaker) }">
              <div><strong>{{ segment.speaker }}</strong><time>{{ formatTime(segment.startMs) }}</time></div>
              <p><template v-for="(piece, index) in highlightPieces(segment)" :key="index"><mark v-if="piece.highlighted">{{ piece.text }}</mark><template v-else>{{ piece.text }}</template></template></p>
            </li>
          </ol>
        </article>
        <div class="factors-column">
          <article class="card factor-card" aria-labelledby="for-title">
            <div class="card-heading"><div><p class="eyebrow">Основания</p><h2 id="for-title">Что говорит за риск</h2></div></div>
            <ul v-if="activeCall.analysis.factorsFor.length" class="factor-list">
              <li v-for="factor in activeCall.analysis.factorsFor" :key="factor.id"><strong>{{ factor.title }}</strong><p>{{ factor.description }}</p><span>{{ Math.round(factor.confidence * 100) }}%</span></li>
            </ul>
            <div v-else class="factor-empty">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>
              <div><strong>{{ isTerminalCall ? 'Основания не выявлены' : 'Основания пока не выявлены' }}</strong><p>В проанализированных фрагментах не найдены факторы, повышающие риск.</p></div>
            </div>
          </article>
          <article class="card factor-card factor-card--against" aria-labelledby="against-title">
            <div class="card-heading"><div><p class="eyebrow">Проверка</p><h2 id="against-title">Что снижает риск</h2></div></div>
            <ul v-if="activeCall.analysis.factorsAgainst.length" class="factor-list">
              <li v-for="factor in activeCall.analysis.factorsAgainst" :key="factor.id"><strong>{{ factor.title }}</strong><p>{{ factor.description }}</p><span>{{ Math.round(factor.confidence * 100) }}%</span></li>
            </ul>
            <div v-else class="factor-empty">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>
              <div><strong>{{ isTerminalCall ? 'Снижающие риск факторы не выявлены' : 'Снижающие риск факторы пока не выявлены' }}</strong><p>В проанализированных фрагментах не найдены основания для снижения оценки.</p></div>
            </div>
          </article>
        </div>
      </section>
    </template>
    </section>
    <BurnoutView v-if="activePage === 'burnout'" />
  </main>
</template>
