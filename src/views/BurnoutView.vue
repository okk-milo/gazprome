<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ContextPills from '../components/ContextPills.vue'
import PeriodComparison from '../components/PeriodComparison.vue'
import SectionCard from '../components/SectionCard.vue'
import { getConversationReport } from '../services/gazprom-api'
import { comparison, formatNumber as n, reportCharts, reportRecommendations, reportSeries, type ReportState } from '../services/conversation-report'
import '../burnout.css'

const result = ref<ReportState>({ state: 'loading' })
let mounted = true
async function load(): Promise<void> {
  result.value = { state: 'loading' }
  try { const response = await getConversationReport(); if (mounted) result.value = response }
  catch { if (mounted) result.value = { state: 'error' } }
}
onMounted(() => void load())
onBeforeUnmount(() => { mounted = false })
const data = computed(() => result.value.state === 'ready' ? result.value.dataset : null)
const series = computed(() => data.value ? reportSeries(data.value) : [])
const context = computed(() => data.value?.overall ? [
  { label: 'Звонки', value: String(data.value.overall.calls), description: 'в отчёте за период' },
  { label: 'Разговоры', value: n(data.value.overall.totalMinutes / 60) + ' ч', description: 'общая длительность' },
  { label: 'Период', value: '8 недель', description: 'динамика по неделям' },
  { label: 'Сравнение', value: 'Начало → конец', description: 'первые и последние две недели' },
] : [])
const metrics = computed(() => data.value?.overall ? reportCharts.map(chart => ({ ...chart,
  value: data.value?.overall?.values[chart.key] ?? 0,
  change: data.value ? comparison(data.value, chart.key) : '',
  max: series.value.find(c => c.key === chart.key)?.max ?? 100,
})) : [])
const summary = computed(() => {
  const d = data.value
  if (!d?.recent || !d.baseline) return 'Недельные показатели помогают сравнить особенности разговоров за выбранный период.'
  return 'В последние две недели средний разговор длится ' + n(d.recent.values.duration) + ' мин, темп речи — ' + n(d.recent.values.speechRate) + ' слов в минуту. Длинные паузы занимают ' + n(d.recent.values.longPauses) + '% времени разговоров.'
})
const workload = computed(() => {
  const w = data.value?.workload, recent = data.value?.recentWorkload
  if (!w) return []
  return [
    { label: 'Звонков за неделю', value: n(w.calls / 8), unit: 'в среднем', color: '#8371e8', detail: recent ? n(recent.calls / 2) + ' в последние две недели' : 'За выбранный период' },
    { label: 'Разговоров за неделю', value: n(w.minutes / 8), unit: 'мин', color: '#35a69b', detail: recent ? n(recent.minutes / 2) + ' мин в последние две недели' : 'За выбранный период' },
    { label: 'Между звонками', value: w.gapMinutes === null ? '—' : n(w.gapMinutes), unit: 'мин', color: '#e8a52d', detail: recent?.gapMinutes == null ? 'Нет соседних звонков для сравнения' : n(recent.gapMinutes) + ' мин в последние две недели' },
    { label: 'После 6-го часа смены', value: n(w.latePercent), unit: '% звонков', color: '#ec7356', detail: recent ? n(recent.latePercent) + '% в последние две недели' : 'За выбранный период' },
  ]
})
const actions = computed(() => data.value ? reportRecommendations(data.value) : [])
const date = (value: string) => value.slice(8, 10) + '.' + value.slice(5, 7)
</script>

<template>
  <section class="burnout-demo conversation-report" aria-label="Динамика разговоров">
    <ContextPills v-if="data?.overall" :items="context" />
    <section v-if="data?.overall" class="report-summary" aria-labelledby="report-summary-title">
      <div class="report-summary__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 19V5M4 19h16M8 14l4-5 4 3 4-7" /></svg></div>
      <div><p class="report-eyebrow">Итог за период</p><h2 id="report-summary-title">Как меняются разговоры</h2><p class="report-summary__text">{{ summary }}</p></div>
      <span class="report-summary__period">8 недель</span>
    </section>
    <SectionCard title="Траектория за 8 недель" description="Каждый график показывает один показатель. Значения соседних недель рассчитаны по одной шкале.">
      <PeriodComparison v-if="result.state === 'ready'" :series="series" :labels="result.dataset.weeks.map(w => 'Неделя ' + (w.index + 1))" :date-ranges="result.dataset.weeks.map(w => date(w.start) + '–' + date(w.end))" />
      <div v-else class="weekly-trajectory__status" role="status" :aria-busy="result.state === 'loading'">
        <p v-if="result.state === 'loading'">Загружаем отчёт…</p>
        <p v-else-if="result.state === 'empty'">Данных пока недостаточно. Отчёт появится после обработки записей.</p>
        <template v-else><p>Не удалось загрузить графики. Попробуйте ещё раз.</p><button type="button" @click="load">Повторить</button></template>
      </div>
    </SectionCard>
    <template v-if="data?.overall">
      <SectionCard title="Показатели разговоров" description="Средние значения за период. Изменение — последние две недели по сравнению с первыми двумя.">
        <div class="report-metrics">
          <article v-for="item in metrics" :key="item.key" class="report-metric" :style="{ '--metric-color': item.color }">
            <h3><i aria-hidden="true"></i>{{ item.label }}</h3>
            <p class="report-metric__value">{{ n(item.value) }}<small>{{ item.unit }}</small></p>
            <div class="report-metric__track" aria-hidden="true"><span :style="{ width: Math.min(100, item.value / item.max * 100) + '%' }"></span></div>
            <span class="report-metric__change">{{ item.change }}</span>
            <p class="report-metric__description">{{ item.description }}</p>
          </article>
        </div>
      </SectionCard>
      <div class="report-bottom">
        <SectionCard title="Контекст нагрузки" description="Распределение звонков и времени за выбранный период.">
          <div class="report-workload">
            <article v-for="item in workload" :key="item.label" :style="{ '--metric-color': item.color }">
              <h3>{{ item.label }}</h3><p><strong>{{ item.value }}</strong><span>{{ item.unit }}</span></p><small>{{ item.detail }}</small>
            </article>
          </div>
        </SectionCard>
        <SectionCard title="Рекомендации" description="На что обратить внимание при работе с обращениями.">
          <ol class="recommendation-list"><li v-for="(action, index) in actions" :key="action"><span>{{ index + 1 }}</span><p>{{ action }}</p></li></ol>
        </SectionCard>
      </div>
    </template>
  </section>
</template>
