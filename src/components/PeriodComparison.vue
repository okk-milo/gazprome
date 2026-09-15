<script setup lang="ts">
import type { ChartSeries } from '../types/analysis'
import { chartValue } from '../services/trajectory'
defineProps<{ series: ChartSeries[]; labels: string[]; dateRanges?: string[] }>()
</script>

<template>
  <div class="weekly-trajectory">
    <p class="weekly-trajectory__direction"><span aria-hidden="true">↑</span> На всех графиках: выше значение — хуже показатель</p>
    <div class="weekly-trajectory__grid">
      <section v-for="item in series" :key="item.key" class="weekly-chart" :aria-labelledby="`chart-${item.key}`">
        <h3 :id="`chart-${item.key}`"><i :style="{ background: item.color }" aria-hidden="true"></i>{{ item.label }}</h3>
        <p class="weekly-chart__description">{{ item.description }}</p>
        <div class="weekly-chart__bars" role="list" :aria-label="`${item.label}, шкала от 0 до 100 баллов`">
          <div v-for="(label, index) in labels" :key="label" class="weekly-chart__column" role="listitem">
            <div class="weekly-chart__track" :aria-label="`${label}: ${chartValue(item.values, index) ?? 'нет данных'}${chartValue(item.values, index) === null ? '' : ' из 100'}`">
              <span v-if="chartValue(item.values, index) !== null" class="weekly-chart__fill" :style="{ height: `${chartValue(item.values, index)}%`, background: item.color }">
                <strong>{{ chartValue(item.values, index) }}</strong>
              </span>
              <span v-else class="weekly-chart__missing">—</span>
            </div>
            <span class="weekly-chart__week">{{ label.replace('Неделя ', 'Нед. ') }}</span>
            <span v-if="dateRanges?.[index]" class="weekly-chart__dates">{{ dateRanges[index] }}</span>
          </div>
        </div>
        <details class="weekly-chart__help">
          <summary>Как читать шкалу</summary>
          <p>0 — минимальная, 100 — максимальная выраженность неблагоприятного показателя в сценарии. Это баллы, не проценты вероятности и не результат диагностики. Нагрузка описывает условия работы, а не состояние человека.</p>
        </details>
      </section>
    </div>
  </div>
</template>
