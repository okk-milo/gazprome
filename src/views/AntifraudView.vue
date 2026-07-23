<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ContextPills from '../components/ContextPills.vue'
import DecisionPanel from '../components/DecisionPanel.vue'
import EvidenceList from '../components/EvidenceList.vue'
import LineChart from '../components/LineChart.vue'
import SectionCard from '../components/SectionCard.vue'
import TranscriptPanel from '../components/TranscriptPanel.vue'
import { getAntifraudAnalysis, type ApiAntifraudSnapshot } from '../services/antifraud-api'
import { createAntifraudPresentation } from '../services/antifraud-presentation'
import { antifraudOutcomePresentation } from '../types/analysis'

const pollingIntervalMs = 3_000
const defaultAnalysisId = 'ad78fce9-fd72-49a6-a6bc-e4a85f5dc0ee'
const analysisId = readAnalysisIdFromUrl()
const snapshot = ref<ApiAntifraudSnapshot | null>(null)
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
let activeRequest: AbortController | null = null
let pollingTimer: number | undefined

const analysis = computed(() => {
  if (!snapshot.value) {
    return null
  }

  return createAntifraudPresentation(snapshot.value)
})

const decisionPresentation = computed(() => {
  if (!analysis.value) {
    return null
  }

  return antifraudOutcomePresentation[analysis.value.decision.result.outcome]
})

const guidanceTitle = computed(() => {
  return analysis.value?.guidance.kind === 'question'
    ? 'Проверочный вопрос оператору'
    : 'Инструкция оператору'
})

const guidanceDescription = computed(() => {
  return analysis.value?.guidance.kind === 'question'
    ? 'Один нейтральный вопрос для дополнительной проверки'
    : 'Действие, которое следует выполнить по текущему кейсу'
})

const guidanceEyebrow = computed(() => {
  return analysis.value?.guidance.kind === 'question'
    ? 'Рекомендуемая формулировка'
    : 'Рекомендуемое действие'
})

const statusTitle = computed(() => {
  if (isLoading.value) {
    return 'Загружаем анализ'
  }

  if (errorMessage.value) {
    return 'Не удалось получить результат'
  }

  const state = snapshot.value?.status.state

  if (state === 'queued') {
    return 'Анализ ожидает обработки'
  }

  if (state === 'processing') {
    return 'Анализ выполняется'
  }

  if (state === 'insufficient_data') {
    return 'Недостаточно данных для анализа'
  }

  if (state === 'failed') {
    return 'Анализ завершился с ошибкой'
  }

  return 'Результат пока недоступен'
})

const statusDescription = computed(() => {
  if (isLoading.value) {
    return 'Запрашиваем сохранённый результат по идентификатору анализа.'
  }

  if (errorMessage.value) {
    return errorMessage.value
  }

  const status = snapshot.value?.status

  if (status?.state === 'queued' || status?.state === 'processing') {
    return 'Экран обновится автоматически после завершения обработки.'
  }

  if (status?.state === 'failed') {
    return status.reason ?? 'Сервис не вернул причину ошибки.'
  }

  if (status?.state === 'insufficient_data') {
    return 'Сервис сохранил результат без решения, потому что текста недостаточно.'
  }

  return 'Для этого идентификатора пока нет готового результата.'
})

async function loadAnalysis(): Promise<void> {
  clearPendingRequest()

  const request = new AbortController()
  activeRequest = request
  isLoading.value = true
  errorMessage.value = null

  try {
    const nextSnapshot = await getAntifraudAnalysis(analysisId, request.signal)

    if (activeRequest !== request) {
      return
    }

    snapshot.value = nextSnapshot

    if (nextSnapshot.status.state === 'queued' || nextSnapshot.status.state === 'processing') {
      pollingTimer = window.setTimeout(() => {
        void loadAnalysis()
      }, pollingIntervalMs)
    }
  } catch (error: unknown) {
    if (activeRequest !== request || isAbortError(error)) {
      return
    }

    snapshot.value = null
    errorMessage.value = error instanceof Error ? error.message : 'Неизвестная ошибка запроса.'
  } finally {
    if (activeRequest === request) {
      activeRequest = null
      isLoading.value = false
    }
  }
}

function clearPendingRequest(): void {
  if (activeRequest) {
    activeRequest.abort()
    activeRequest = null
  }

  if (pollingTimer !== undefined) {
    window.clearTimeout(pollingTimer)
    pollingTimer = undefined
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function readAnalysisIdFromUrl(): string {
  const url = new URL(window.location.href)
  const requestedAnalysisId = url.searchParams.get('analysisId')?.trim()

  if (requestedAnalysisId) {
    return requestedAnalysisId
  }

  url.searchParams.set('analysisId', defaultAnalysisId)
  window.history.replaceState(null, '', url)
  return defaultAnalysisId
}

onMounted(() => {
  void loadAnalysis()
})

onUnmounted(() => {
  clearPendingRequest()
})
</script>

<template>
  <main class="page-content">
    <SectionCard v-if="!analysis || !decisionPresentation" :title="statusTitle" :description="statusDescription">
      <div class="analysis-status" :class="{ 'analysis-status--error': errorMessage }">
        <span aria-hidden="true">i</span>
        <p v-if="isLoading">Ожидание ответа локального API</p>
        <button v-else class="analysis-status__retry" type="button" @click="loadAnalysis">Повторить запрос</button>
      </div>
    </SectionCard>

    <template v-else>
      <ContextPills :items="analysis.context" />

      <DecisionPanel
        :label="decisionPresentation.label"
        :title="decisionPresentation.title"
        :score="analysis.decision.result.score"
        :tone="decisionPresentation.tone"
        :summary="analysis.decision.summary"
      />

      <SectionCard :title="analysis.confidence.label" :description="analysis.confidence.description">
        <LineChart
          :series="analysis.confidence.series"
          :annotations="analysis.confidence.annotations"
          :x-axis-labels="analysis.confidence.xAxisLabels"
          start-label="00:00"
          :end-label="analysis.callDuration"
          chart-label="Динамика балла риска по расшифровке звонка"
        />
      </SectionCard>

      <div class="analysis-grid analysis-grid--antifraud">
        <SectionCard
          class-name="analysis-grid__transcript"
          title="Расшифровка беседы"
          description="Реплики по ролям. Выделения связаны с подтверждёнными признаками анализа"
        >
          <template #action>
            <span class="duration-label">Длительность · {{ analysis.callDuration }}</span>
          </template>
          <TranscriptPanel :messages="analysis.transcript" />
        </SectionCard>

        <div class="analysis-grid__aside">
          <SectionCard v-if="analysis.guidance.kind !== 'none'" :title="guidanceTitle" :description="guidanceDescription">
            <div class="operator-guidance">
              <span class="operator-guidance__eyebrow">{{ guidanceEyebrow }}</span>
              <blockquote>{{ analysis.guidance.text }}</blockquote>
              <p><strong>Зачем:</strong> {{ analysis.guidance.purpose }}</p>
              <p v-if="analysis.guidance.observe.length > 0">
                <strong>Наблюдать:</strong> {{ analysis.guidance.observe.join(', ') }}
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Основания решения"
            description="Подтверждённые текстом фрагменты, на которые опирается анализ"
          >
            <EvidenceList v-if="analysis.evidence.length > 0" :items="analysis.evidence" />
            <p v-else class="evidence-list__empty">Подтверждённых текстовых признаков не найдено.</p>
          </SectionCard>
        </div>
      </div>
    </template>
  </main>
</template>
