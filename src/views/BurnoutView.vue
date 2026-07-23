<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ContextPills from '../components/ContextPills.vue'
import DecisionPanel from '../components/DecisionPanel.vue'
import EvidenceList from '../components/EvidenceList.vue'
import MetricTile from '../components/MetricTile.vue'
import PeriodComparison from '../components/PeriodComparison.vue'
import SectionCard from '../components/SectionCard.vue'
import { burnoutFallbackData } from '../data/burnout'
import { getBurnoutAnalysis, type ApiBurnoutSnapshot } from '../services/burnout-api'
import { createBurnoutPresentation } from '../services/burnout-presentation'
import { burnoutOutcomePresentation } from '../types/analysis'

const pollingIntervalMs = 3_000
const analysisId = new URL(window.location.href).searchParams.get('burnoutAnalysisId')?.trim() ?? ''
const snapshot = ref<ApiBurnoutSnapshot | null>(null)
const isLoading = ref(analysisId.length > 0)
const errorMessage = ref<string | null>(null)
let activeRequest: AbortController | null = null
let pollingTimer: number | undefined

const analysis = computed(() => {
  if (!analysisId) {
    return burnoutFallbackData
  }

  return snapshot.value ? createBurnoutPresentation(snapshot.value) : null
})

const decisionPresentation = computed(() => {
  return analysis.value ? burnoutOutcomePresentation[analysis.value.decision.result.outcome] : null
})

const statusTitle = computed(() => {
  if (errorMessage.value) return 'Не удалось получить результат'
  if (snapshot.value?.status.state === 'queued') return 'Анализ ожидает обработки'
  if (snapshot.value?.status.state === 'processing') return 'Анализ выполняется'
  if (snapshot.value?.status.state === 'insufficient_data') return 'Недостаточно данных для сравнения'
  if (snapshot.value?.status.state === 'failed') return 'Анализ завершился с ошибкой'
  return 'Загружаем анализ'
})

const statusDescription = computed(() => {
  if (errorMessage.value) return errorMessage.value
  if (snapshot.value?.status.state === 'queued' || snapshot.value?.status.state === 'processing') {
    return 'Экран обновится автоматически после завершения обработки.'
  }
  return 'Запрашиваем сохранённый результат по идентификатору анализа.'
})

async function loadAnalysis(): Promise<void> {
  clearPendingRequest()
  const request = new AbortController()
  activeRequest = request
  isLoading.value = true
  errorMessage.value = null

  try {
    const nextSnapshot = await getBurnoutAnalysis(analysisId, request.signal)
    if (activeRequest !== request) return
    snapshot.value = nextSnapshot

    if (nextSnapshot.status.state === 'queued' || nextSnapshot.status.state === 'processing') {
      pollingTimer = window.setTimeout(() => void loadAnalysis(), pollingIntervalMs)
    }
  } catch (error: unknown) {
    if (activeRequest !== request || isAbortError(error)) return
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
  activeRequest?.abort()
  activeRequest = null
  if (pollingTimer !== undefined) window.clearTimeout(pollingTimer)
  pollingTimer = undefined
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

onMounted(() => {
  if (analysisId) void loadAnalysis()
})

onUnmounted(clearPendingRequest)
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
      :recommendation="analysis.decision.recommendation"
    />

    <SectionCard :title="analysis.trajectory.label" :description="analysis.trajectory.description">
      <PeriodComparison
        :series="analysis.trajectory.series"
        :labels="analysis.trajectory.xAxisLabels"
      />
    </SectionCard>

      <div class="burnout-columns">
      <div class="burnout-columns__column">
        <SectionCard
          title="Шкалы состояния"
          description="Значения показывают отклонение от собственной нормы сотрудника, а не сравнение с коллегами"
        >
          <div class="metric-grid">
            <MetricTile v-for="item in analysis.metrics" :key="item.id" :item="item" />
          </div>
        </SectionCard>

        <SectionCard
          title="Контекст нагрузки"
          description="Нагрузка учитывается как контроль, но не приравнивается к состоянию сотрудника"
        >
          <div class="workload-list">
            <MetricTile v-for="item in analysis.workload" :key="item.id" :item="item" />
          </div>
        </SectionCard>
      </div>

      <div class="burnout-columns__column">
        <SectionCard
          title="Что изменилось"
          description="Наблюдаемые речевые признаки и их вклад в текущий сигнал"
        >
          <EvidenceList :items="analysis.evidence" />
        </SectionCard>

        <SectionCard title="Что можно сделать" description="Рекомендации для руководителя и HR">
          <ol class="recommendation-list">
            <li v-for="(action, index) in analysis.actions" :key="action">
              <span>{{ index + 1 }}</span>
              <p>{{ action }}</p>
            </li>
          </ol>
        </SectionCard>
      </div>
      </div>
    </template>
  </main>
</template>
