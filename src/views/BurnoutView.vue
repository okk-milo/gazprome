<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ContextPills from '../components/ContextPills.vue'
import DecisionPanel from '../components/DecisionPanel.vue'
import MetricTile from '../components/MetricTile.vue'
import PeriodComparison from '../components/PeriodComparison.vue'
import SectionCard from '../components/SectionCard.vue'
import { getTechnicalDataset } from '../services/gazprom-api'
import { technicalCharts, technicalLabels, type TechnicalState } from '../services/technical-dataset'
import type { ChartSeries, ContextItem, MetricItem } from '../types/analysis'
import '../burnout.css'

const result = ref<TechnicalState>({ state: 'loading' })
let mounted = true
async function load(): Promise<void> {
  result.value = { state: 'loading' }
  try { const response = await getTechnicalDataset(); if (mounted) result.value = response }
  catch { if (mounted) result.value = { state: 'error' } }
}
onMounted(() => void load())
onBeforeUnmount(() => { mounted = false })
const data = computed(() => result.value.state === 'ready' ? result.value.dataset : null)
const format = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n)
const date = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(value))
const timestamp = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`
const context = computed<ContextItem[]>(() => data.value ? [
  { label: 'В расчёте', value: `${data.value.coverage.measured} из ${data.value.coverage.total} записей`, description: 'технические признаки диалогов целиком' },
  { label: 'Речевые фрагменты ASR', value: data.value.overall ? `${format(data.value.overall.speechSeconds / 60)} мин` : 'Нет измерений', description: 'пересекающиеся фрагменты не дублируются' },
  { label: 'Период сравнения', value: '8 недель', description: 'начальный период — недели 1–2' },
  { label: 'Покрытие', value: `${data.value.coverage.excluded} исключено · ${data.value.coverage.failed} ошибок`, description: 'неполные данные не участвуют в расчёте' },
] : [])
const series = computed<ChartSeries[]>(() => technicalCharts.map(chart => ({ ...chart, direction: 'higher-is-more', values: data.value?.weeks.map(w => w.measures?.scores[chart.key] ?? null) ?? [] })))
const summary = computed(() => {
  const d = data.value
  if (!d?.overall) return ''
  if (!d.baseline || !d.recent) return `Обработано ${d.coverage.measured} записей. Для сравнения первых и последних двух недель пока недостаточно данных.`
  const delta = d.recent.index - d.baseline.index
  const change = Math.abs(delta) < 0.05 ? 'не отличается от начального периода' : `${delta > 0 ? 'выше' : 'ниже'} начального периода на ${format(Math.abs(delta))} балла`
  return `В последних двух неделях технический индекс — ${format(d.recent.index)} из 100: ${change}. Сравнение рассчитано после распределения звонков по неделям.`
})
const metrics = computed<MetricItem[]>(() => {
  const dataset = data.value, overall = dataset?.overall
  if (!dataset || !overall) return []
  return technicalCharts.map(chart => {
  const recent = dataset.recent?.scores[chart.key], baseline = dataset.baseline?.scores[chart.key]
  const delta = recent == null || baseline == null ? null : recent - baseline
  return { id: chart.key, label: chart.label, value: overall.scores[chart.key], delta: delta == null ? 'Недостаточно данных для сравнения' : `${delta > 0 ? '+' : ''}${format(delta)} балла: недели 7–8 к 1–2`, description: chart.description, tone: 'neutral' }
  })
})
const counts = computed(() => {
  const m = data.value?.overall
  return m ? [
    { label: 'Просьбы повторить и уточнения', value: `${m.counts.repeat_request + m.counts.clarification}`, detail: `${format(m.rates.repetition)} события на минуту речи` },
    { label: 'Явные самокоррекции', value: `${m.counts.self_correction}`, detail: `${format(m.rates.correction)} события на минуту речи` },
    { label: 'Жалобы и запросы эскалации', value: `${m.counts.explicit_complaint + m.counts.escalation_request}`, detail: `${format(m.rates.complaint)} события на минуту речи` },
    { label: 'Время фрагментов ASR / время записей', value: `${format(m.speechSeconds / 60)} / ${format(m.durationSeconds / 60)} мин`, detail: `${format(m.scores.speechDensity)}% длительности записей` },
  ] : []
})
</script>

<template>
  <section class="burnout-demo" aria-label="Техническая динамика разговоров">
    <ContextPills v-if="data" :items="context" />
    <DecisionPanel v-if="data?.overall" label="Итог анализа" title="Технические показатели разговоров" :score="Math.round(data.overall.index)" score-label="Сводный технический индекс" tone="info" :summary="summary" />
    <SectionCard title="Траектория за 8 недель" description="Каждый столбец — группа звонков. Выше значение — чаще найден признак или выше плотность речи.">
      <PeriodComparison v-if="result.state === 'ready'" :series="series" :labels="result.dataset.weeks.map(w => `Неделя ${w.index + 1}`)" :date-ranges="result.dataset.weeks.map(w => `${date(w.start)}–${date(w.end)}`)" />
      <div v-else class="weekly-trajectory__status" role="status" :aria-busy="result.state === 'loading'">
        <p v-if="result.state === 'loading'">Загружаем графики…</p>
        <p v-else-if="result.state === 'empty'">Расчётные данные ещё не опубликованы.</p>
        <template v-else><p>Не удалось загрузить графики. Попробуйте ещё раз.</p><button type="button" @click="load">Повторить</button></template>
      </div>
    </SectionCard>
    <div v-if="data?.overall" class="burnout-columns">
      <div class="burnout-columns__column">
        <SectionCard title="Показатели и сравнение" description="Значение — по всей выборке; изменение — последние две недели относительно первых двух.">
          <div class="metric-grid"><MetricTile v-for="item in metrics" :key="item.id" :item="item" /></div>
        </SectionCard>
        <SectionCard title="Основания расчёта" description="Найденные события и длительности, на которых построены показатели.">
          <dl class="technical-counts"><div v-for="count in counts" :key="count.label"><dt>{{ count.label }}</dt><dd>{{ count.value }}</dd><small>{{ count.detail }}</small></div></dl>
        </SectionCard>
      </div>
      <div class="burnout-columns__column">
        <SectionCard title="Фрагменты расшифровок" description="Дословные фрагменты, отнесённые к событиям. Оценивается содержание разговора, а не личность участника.">
          <ul v-if="data.observations.length" class="observed-examples technical-examples" aria-label="Найденные речевые события" tabindex="0">
            <li v-for="item in data.observations" :key="`${item.sourceId}:${item.segmentId}:${item.kind}`"><strong>{{ technicalLabels[item.kind] }}</strong><blockquote>{{ item.quote }}</blockquote><small>Запись {{ item.sourceId.slice(0, 8) }} · {{ timestamp(item.startMs) }}</small></li>
          </ul>
          <p v-else>События с подтверждающими фрагментами не найдены.</p>
        </SectionCard>
      </div>
    </div>
  </section>
</template>
