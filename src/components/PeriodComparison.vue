<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import type { ChartSeries } from '../types/analysis'
import { chartValue } from '../services/trajectory'
defineProps<{ series: ChartSeries[]; labels: string[]; dateRanges?: string[] }>()
const helpDialog = ref<HTMLDialogElement | null>(null)
const selectedChart = ref<ChartSeries | null>(null)
const formatScore = (value: number | null) => value === null ? 'нет данных' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)
const valueAt = (item: ChartSeries, index: number) => chartValue(item.values, index, item.max ?? 100)
const heightAt = (item: ChartSeries, index: number) => (valueAt(item, index) ?? 0) / (item.max ?? 100) * 100

async function openHelp(item: ChartSeries): Promise<void> {
  selectedChart.value = item
  await nextTick()
  if (helpDialog.value && !helpDialog.value.open) helpDialog.value.showModal()
}

function closeHelp(): void {
  helpDialog.value?.close()
}

function keepFocusInDialog(event: KeyboardEvent): void {
  const buttons = helpDialog.value?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
  const first = buttons?.[0]
  const last = buttons?.[buttons.length - 1]
  if (!first || !last) return
  if (event.shiftKey && event.target === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && event.target === last) {
    event.preventDefault()
    first.focus()
  }
}

function closeOnBackdrop(event: MouseEvent): void {
  const dialog = helpDialog.value
  if (!dialog || event.target !== dialog) return
  const rect = dialog.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeHelp()
}

onBeforeUnmount(closeHelp)
</script>

<template>
  <div class="weekly-trajectory">
    <div class="weekly-trajectory__grid">
      <section v-for="item in series" :key="item.key" class="weekly-chart" :aria-labelledby="`chart-${item.key}`">
        <div class="weekly-chart__header">
          <h3 :id="`chart-${item.key}`"><i :style="{ background: item.color }" aria-hidden="true"></i>{{ item.label }}</h3>
          <button type="button" class="weekly-chart__info" :aria-label="`О шкале «${item.label}»`" aria-haspopup="dialog" @click="openHelp(item)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7h.01" /></svg>
          </button>
        </div>
        <p class="weekly-chart__description">{{ item.description }}</p>
        <div class="weekly-chart__scale"><span>{{ item.unit ?? 'баллы' }}</span><span>0–{{ formatScore(item.max ?? 100) }}</span></div>
        <div class="weekly-chart__bars" role="list" :aria-label="`${item.label}, от 0 до ${item.max ?? 100} ${item.unit ?? 'баллов'}`">
          <div v-for="(label, index) in labels" :key="label" class="weekly-chart__column" role="listitem">
            <div class="weekly-chart__track" :aria-label="`${label}: ${formatScore(valueAt(item, index))} ${item.unit ?? 'баллов'}`">
              <span v-if="valueAt(item, index) !== null" class="weekly-chart__fill" :style="{ height: `${heightAt(item, index)}%`, background: item.color }">
                <strong>{{ formatScore(valueAt(item, index)) }}</strong>
              </span>
              <span v-else class="weekly-chart__missing">—</span>
            </div>
            <span class="weekly-chart__week">{{ label.replace('Неделя ', 'Нед. ') }}</span>
            <span v-if="dateRanges?.[index]" class="weekly-chart__dates">{{ dateRanges[index] }}</span>
          </div>
        </div>
      </section>
    </div>
    <dialog ref="helpDialog" class="weekly-chart-dialog" aria-labelledby="weekly-chart-help-title" aria-describedby="weekly-chart-help-description" @close="selectedChart = null" @click="closeOnBackdrop" @keydown.tab="keepFocusInDialog">
      <template v-if="selectedChart">
        <div class="weekly-chart-dialog__header">
          <h2 id="weekly-chart-help-title">{{ selectedChart.label }}</h2>
          <button type="button" class="weekly-chart-dialog__close" aria-label="Закрыть пояснение" autofocus @click="closeHelp">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <p id="weekly-chart-help-description" class="weekly-chart-dialog__direction">{{ selectedChart.description }}</p>
        <template v-if="selectedChart.help">
          <p>{{ selectedChart.help }}</p>
          <p>Каждый столбец объединяет звонки одной недели. Выше столбец — больше значение показателя. Если данных нет, показан прочерк.</p>
        </template>
        <template v-else>
          <p>Каждый столбец — одна неделя. 0 — минимальная, 100 — максимальная выраженность неблагоприятного показателя.</p>
          <p>Это баллы, не проценты вероятности и не результат диагностики.</p>
          <p v-if="selectedChart.key === 'workload'">Нагрузка описывает условия работы, а не состояние человека.</p>
        </template>
        <button type="button" class="weekly-chart-dialog__done" @click="closeHelp">Понятно</button>
      </template>
    </dialog>
  </div>
</template>
