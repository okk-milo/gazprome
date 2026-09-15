<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ContextPills from '../components/ContextPills.vue'
import BurnoutDatasetCoverage from '../components/BurnoutDatasetCoverage.vue'
import DecisionPanel from '../components/DecisionPanel.vue'
import MetricTile from '../components/MetricTile.vue'
import PeriodComparison from '../components/PeriodComparison.vue'
import SectionCard from '../components/SectionCard.vue'
import { burnoutDemoData as analysis } from '../data/burnout'
import { getBurnoutDataset } from '../services/gazprom-api'
import { scenarioWeeks, type DatasetState } from '../services/burnout-dataset'
import { scenarioSeries } from '../services/trajectory'
import '../burnout.css'

const result = ref<DatasetState>({ state: 'loading' })
let mounted = true
async function load(): Promise<void> {
  result.value = { state: 'loading' }
  try {
    const response = await getBurnoutDataset()
    if (mounted) result.value = response
  } catch {
    if (mounted) result.value = { state: 'error' }
  }
}
onMounted(() => void load())
onBeforeUnmount(() => { mounted = false })
const weeks = computed(() => result.value.state === 'ready' ? scenarioWeeks(result.value.dataset.periodStart) : [])
const series = computed(() => {
  const state = result.value
  if (state.state !== 'ready') return []
  return scenarioSeries(analysis.trajectory.series, state.dataset.weeklyScores)
})
const metrics = computed(() => {
  const latest = result.value.state === 'ready' ? result.value.dataset.weeklyScores.at(-1) : null
  return analysis.metrics.map(item => ({ ...item, value: latest && (item.id === 'exhaustion' || item.id === 'distance') ? latest[item.id] : item.value }))
})
const context = computed(() => analysis.context.map(item => item.label === 'Данные'
  ? { ...item, value: '8 недель · 56 дней', description: result.value.state === 'ready' ? `${result.value.dataset.coverage.accepted} диалогов проверено полностью; шкалы заданы сценарием` : 'состав набора пока недоступен' }
  : item))
</script>

<template>
  <section class="burnout-demo" aria-label="Демонстрационная оценка выгорания">
    <ContextPills :items="context" />
    <BurnoutDatasetCoverage :result="result" @retry="load" />

    <DecisionPanel
      label="Итог наблюдения"
      title="Изменение показателей за период"
      :score="analysis.decision.result.score"
      score-label="Индекс выгорания · сценарий"
      tone="warning"
      :summary="analysis.decision.summary"
    />

    <SectionCard v-if="result.state === 'ready'" :title="analysis.trajectory.label" :description="analysis.trajectory.description">
      <p class="weekly-trajectory__period">Начало сценария: {{ result.dataset.periodStart }} · календарные даты условные</p>
      <PeriodComparison :series="series" :labels="weeks.map(week => week.label)" :date-ranges="weeks.map(week => week.dates)" />
    </SectionCard>

    <div class="burnout-columns">
      <div class="burnout-columns__column">
        <SectionCard
          title="Шкалы состояния"
          description="Условные шкалы сценария. Реальная оценка состояния требует отдельной самооценки, а не выводов по звонкам"
        >
          <div class="metric-grid">
            <MetricTile v-for="item in metrics" :key="item.id" :item="item" />
          </div>
        </SectionCard>
        <SectionCard
          title="Контекст нагрузки"
          description="Пример показателей рабочих условий. Нагрузка не приравнивается к состоянию сотрудника"
        >
          <div class="workload-list">
            <MetricTile v-for="item in analysis.workload" :key="item.id" :item="item" />
          </div>
        </SectionCard>
      </div>

      <div class="burnout-columns__column">
        <SectionCard title="Примеры из расшифровок" description="Проверенные по тексту речевые события. Не показатели состояния человека; говорящий и качество аудио требуют отдельной проверки">
          <ul v-if="result.state === 'ready' && result.dataset.observations.length" class="observed-examples">
            <li v-for="item in result.dataset.observations" :key="`${item.sourceId}:${item.segmentId}:${item.title}`">
              <strong>{{ item.title }}</strong>
              <blockquote>{{ item.quote }}</blockquote>
              <small>Запись {{ item.sourceId.slice(0, 8) }} · {{ Math.floor(item.startMs / 60000).toString().padStart(2, '0') }}:{{ Math.floor(item.startMs / 1000 % 60).toString().padStart(2, '0') }} · роль не подтверждена</small>
            </li>
          </ul>
          <p v-else>Проверенные примеры пока недоступны. Отсутствие примеров не означает отсутствие речевых событий.</p>
        </SectionCard>
        <SectionCard title="Рекомендации для руководителя и HR" description="Варианты поддержки для обсуждения, не автоматические назначения">
          <ol class="recommendation-list">
            <li v-for="(action, index) in analysis.actions" :key="action">
              <span>{{ index + 1 }}</span><p>{{ action }}</p>
            </li>
          </ol>
        </SectionCard>
      </div>
    </div>
  </section>
</template>
