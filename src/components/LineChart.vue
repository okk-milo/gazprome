<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChartSeries, TimelineAnnotation } from '../types/analysis'

interface LineChartProps {
  series: ChartSeries[]
  annotations?: TimelineAnnotation[]
  xAxisLabels: string[]
  startLabel: string
  endLabel: string
  chartLabel: string
}

interface RenderedSeries {
  key: string
  color: string
  dashed: boolean
  path: string
}

interface ActiveValue {
  key: string
  label: string
  color: string
  value: number
}

interface ChartTooltip {
  label: string
  position: number
  values: ActiveValue[]
}

const props = defineProps<LineChartProps>()

const chartWidth = 720
const chartHeight = 240
const chartLeft = 38
const chartRight = 18
const chartTop = 16
const chartBottom = 36
const verticalRange = chartHeight - chartTop - chartBottom
const horizontalRange = chartWidth - chartLeft - chartRight
const activeIndex = ref<number | null>(null)

const pointCount = computed(() => {
  return props.series.reduce((currentMaximum, item) => {
    return Math.max(currentMaximum, item.values.length)
  }, 0)
})

const renderedSeries = computed<RenderedSeries[]>(() => {
  return props.series.map((item) => {
    return {
      key: item.key,
      color: item.color,
      dashed: item.dashed === true,
      path: buildPath(item.values),
    }
  })
})

const activeTooltip = computed<ChartTooltip | null>(() => {
  if (activeIndex.value === null) {
    return null
  }

  const index = activeIndex.value
  const lastIndex = Math.max(pointCount.value - 1, 0)
  const rawPosition = lastIndex === 0 ? 50 : (index / lastIndex) * 100
  const position = Math.min(Math.max(rawPosition, 12), 88)
  const label = props.xAxisLabels[index] ?? `Точка ${index + 1}`

  return {
    label,
    position,
    values: props.series.map((item) => {
      return {
        key: item.key,
        label: item.label,
        color: item.color,
        value: getSeriesValue(item, index),
      }
    }),
  }
})

function buildPath(values: number[]): string {
  return values
    .map((value, index) => {
      const command = index === 0 ? 'M' : 'L'

      return `${command} ${getPointX(index, values.length)} ${getPointY(value)}`
    })
    .join(' ')
}

function getPointX(index: number, valueCount: number): number {
  const divisor = Math.max(valueCount - 1, 1)

  return chartLeft + (horizontalRange * index) / divisor
}

function getPointY(value: number): number {
  return chartTop + verticalRange - (verticalRange * value) / 100
}

function getSeriesValue(series: ChartSeries, index: number): number {
  const lastValue = series.values[series.values.length - 1] ?? 0

  return series.values[index] ?? lastValue
}

function getAnnotationX(value: number): number {
  return chartLeft + (horizontalRange * value) / 100
}

function getLastPoint(series: ChartSeries): { x: number; y: number } {
  const lastIndex = Math.max(series.values.length - 1, 0)
  const lastValue = getSeriesValue(series, lastIndex)

  return {
    x: getPointX(lastIndex, series.values.length),
    y: getPointY(lastValue),
  }
}

function updateActivePoint(event: PointerEvent): void {
  if (!(event.currentTarget instanceof SVGSVGElement) || pointCount.value === 0) {
    return
  }

  const bounds = event.currentTarget.getBoundingClientRect()
  const horizontalPosition = ((event.clientX - bounds.left) / bounds.width) * chartWidth
  const rawIndex = Math.round(((horizontalPosition - chartLeft) / horizontalRange) * (pointCount.value - 1))
  const maximumIndex = pointCount.value - 1

  activeIndex.value = Math.min(Math.max(rawIndex, 0), maximumIndex)
}

function clearActivePoint(): void {
  activeIndex.value = null
}

function activateFirstPoint(): void {
  if (pointCount.value > 0) {
    activeIndex.value = 0
  }
}

function moveActivePoint(offset: number): void {
  const maximumIndex = pointCount.value - 1

  if (maximumIndex < 0) {
    return
  }

  const currentIndex = activeIndex.value ?? 0
  activeIndex.value = Math.min(Math.max(currentIndex + offset, 0), maximumIndex)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    moveActivePoint(-1)
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    moveActivePoint(1)
  }

  if (event.key === 'Home') {
    event.preventDefault()
    activeIndex.value = 0
  }

  if (event.key === 'End') {
    event.preventDefault()
    activeIndex.value = Math.max(pointCount.value - 1, 0)
  }
}
</script>

<template>
  <div class="line-chart">
    <div class="line-chart__legend">
      <span v-for="item in props.series" :key="item.key">
        <i :style="{ background: item.color }" :class="{ 'line-chart__dash': item.dashed }"></i>
        {{ item.label }}
      </span>
    </div>

    <div v-if="props.annotations && props.annotations.length > 0" class="line-chart__annotations" aria-label="События на графике">
      <span v-for="annotation in props.annotations" :key="annotation.id ?? `${annotation.label}-${annotation.value}`">
        <i aria-hidden="true"></i>
        <strong v-if="annotation.timestamp">{{ annotation.timestamp }}</strong>
        {{ annotation.label }}
      </span>
    </div>

    <div class="line-chart__canvas">
      <svg
        class="line-chart__svg"
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        role="application"
        tabindex="0"
        :aria-label="`${props.chartLabel}. Наведите курсор или используйте стрелки для просмотра значений`"
        @pointermove="updateActivePoint"
        @pointerdown="updateActivePoint"
        @pointerleave="clearActivePoint"
        @focus="activateFirstPoint"
        @blur="clearActivePoint"
        @keydown="handleKeydown"
      >
        <g v-for="line in [0, 25, 50, 75, 100]" :key="line">
          <line
            :x1="chartLeft"
            :x2="chartWidth - chartRight"
            :y1="getPointY(line)"
            :y2="getPointY(line)"
            class="line-chart__grid-line"
          />
          <text :x="chartLeft - 9" :y="getPointY(line) + 4" class="line-chart__axis-label" text-anchor="end">
            {{ line }}
          </text>
        </g>

        <g v-for="annotation in props.annotations" :key="annotation.id ?? `${annotation.label}-${annotation.value}`">
          <line
            :x1="getAnnotationX(annotation.value)"
            :x2="getAnnotationX(annotation.value)"
            :y1="chartTop"
            :y2="chartTop + verticalRange"
            class="line-chart__annotation-line"
          />
        </g>

        <path
          v-for="item in renderedSeries"
          :key="item.key"
          :d="item.path"
          :stroke="item.color"
          :class="{ 'line-chart__path--dashed': item.dashed }"
          class="line-chart__path"
        />

        <g v-for="item in props.series" :key="`${item.key}-point`">
          <circle :cx="getLastPoint(item).x" :cy="getLastPoint(item).y" r="4" :fill="item.color" />
          <circle
            :cx="getLastPoint(item).x"
            :cy="getLastPoint(item).y"
            r="7"
            :stroke="item.color"
            class="line-chart__point-ring"
          />
        </g>

        <g v-if="activeIndex !== null" class="line-chart__active-point">
          <line
            :x1="getPointX(activeIndex, pointCount)"
            :x2="getPointX(activeIndex, pointCount)"
            :y1="chartTop"
            :y2="chartTop + verticalRange"
          />
          <circle
            v-for="item in props.series"
            :key="`${item.key}-active`"
            :cx="getPointX(activeIndex, pointCount)"
            :cy="getPointY(getSeriesValue(item, activeIndex))"
            r="5"
            :fill="item.color"
          />
        </g>

        <text :x="chartLeft" :y="chartHeight - 13" class="line-chart__axis-label">{{ props.startLabel }}</text>
        <text :x="chartWidth - chartRight" :y="chartHeight - 13" class="line-chart__axis-label" text-anchor="end">
          {{ props.endLabel }}
        </text>
      </svg>

      <div
        v-if="activeTooltip"
        class="line-chart__tooltip"
        :style="{ left: `${activeTooltip.position}%` }"
        aria-live="polite"
      >
        <strong>{{ activeTooltip.label }}</strong>
        <span v-for="item in activeTooltip.values" :key="item.key">
          <i :style="{ background: item.color }"></i>
          {{ item.label }}: {{ item.value }}
        </span>
      </div>
    </div>
  </div>
</template>
