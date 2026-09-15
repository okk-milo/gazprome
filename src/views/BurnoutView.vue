<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ContextPills from '../components/ContextPills.vue'
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
</script>

<template>
  <section class="burnout-demo" aria-label="Оценка выгорания">
    <ContextPills :items="analysis.context" />

    <DecisionPanel
      label="Итог наблюдения"
      title="Изменение показателей за период"
      :score="analysis.decision.result.score"
      score-label="Индекс выгорания"
      tone="warning"
      :summary="analysis.decision.summary"
    />

    <SectionCard :title="analysis.trajectory.label" :description="analysis.trajectory.description">
      <PeriodComparison v-if="result.state === 'ready'" :series="series" :labels="weeks.map(week => week.label)" :date-ranges="weeks.map(week => week.dates)" />
      <div v-else class="weekly-trajectory__status" role="status" :aria-busy="result.state === 'loading'">
        <p v-if="result.state === 'loading'">Загружаем графики…</p>
        <p v-else-if="result.state === 'empty'">Данные ещё не опубликованы. Недельные графики появятся после их подготовки.</p>
        <template v-else>
          <p>Не удалось загрузить графики. Попробуйте ещё раз.</p>
          <button type="button" @click="load">Повторить</button>
        </template>
      </div>
    </SectionCard>

    <div class="burnout-columns">
      <div class="burnout-columns__column">
        <SectionCard
          title="Шкалы состояния"
          description="Оценка состояния требует отдельной самооценки и не заменяется анализом звонков"
        >
          <div class="metric-grid">
            <MetricTile v-for="item in metrics" :key="item.id" :item="item" />
          </div>
        </SectionCard>
        <SectionCard
          title="Контекст нагрузки"
          description="Показатели рабочих условий. Нагрузка не приравнивается к состоянию сотрудника"
        >
          <div class="workload-list">
            <MetricTile v-for="item in analysis.workload" :key="item.id" :item="item" />
          </div>
        </SectionCard>
      </div>

      <div class="burnout-columns__column">
        <SectionCard title="Фрагменты расшифровок" description="Проверенные по тексту речевые события. Не показатели состояния человека; говорящий и качество аудио требуют отдельной проверки">
          <ul v-if="result.state === 'ready' && result.dataset.observations.length" class="observed-examples">
            <li v-for="item in result.dataset.observations" :key="`${item.sourceId}:${item.segmentId}:${item.title}`">
              <strong>{{ item.title }}</strong>
              <blockquote>{{ item.quote }}</blockquote>
              <small>Запись {{ item.sourceId.slice(0, 8) }} · {{ Math.floor(item.startMs / 60000).toString().padStart(2, '0') }}:{{ Math.floor(item.startMs / 1000 % 60).toString().padStart(2, '0') }} · роль не подтверждена</small>
            </li>
          </ul>
          <p v-else>Проверенные фрагменты пока недоступны. Их отсутствие не означает отсутствие речевых событий.</p>
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
