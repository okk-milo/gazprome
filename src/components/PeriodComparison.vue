<script setup lang="ts">
import type { ChartSeries } from '../types/analysis'

interface PeriodComparisonProps {
  series: ChartSeries[]
  labels: string[]
}

const props = defineProps<PeriodComparisonProps>()

function getSeriesValue(series: ChartSeries, index: number): number {
  return series.values[index] ?? 0
}

function getFillStyle(series: ChartSeries): Record<string, string> {
  if (series.dashed) {
    return {
      background: `repeating-linear-gradient(90deg, ${series.color} 0 7px, rgba(154, 167, 184, 0.28) 7px 11px)`,
    }
  }

  return { background: series.color }
}

function getValueFillStyle(series: ChartSeries, index: number): Record<string, string> {
  const value = getSeriesValue(series, index)
  const style = getFillStyle(series)

  return {
    width: `${value}%`,
    background: style.background,
  }
}
</script>

<template>
  <div class="period-comparison" aria-label="Сравнение периодов по шкалам">
    <section v-for="(label, index) in props.labels" :key="label" class="period-comparison__item">
      <h3>{{ label }}</h3>

      <div v-for="item in props.series" :key="item.key" class="period-comparison__row">
        <span class="period-comparison__series">
          <i :style="getFillStyle(item)" aria-hidden="true"></i>
          {{ item.label }}
        </span>
        <div
          class="period-comparison__track"
          :aria-label="`${item.label}: ${getSeriesValue(item, index)}%`"
          role="img"
        >
          <span :style="getValueFillStyle(item, index)"></span>
        </div>
        <strong>{{ getSeriesValue(item, index) }}%</strong>
      </div>
    </section>
  </div>
</template>
