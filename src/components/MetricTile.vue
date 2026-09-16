<script setup lang="ts">
import type { MetricItem } from '../types/analysis'

interface MetricTileProps {
  item: MetricItem
}

const props = defineProps<MetricTileProps>()
</script>

<template>
  <article class="metric-tile" :class="`metric-tile--${props.item.tone}`">
    <div class="metric-tile__topline">
      <span>{{ props.item.label }}</span>
      <em>{{ props.item.delta }}</em>
    </div>
    <div class="metric-tile__value">
      {{ new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(props.item.value) }}<small v-if="props.item.unit">{{ props.item.unit }}</small>
    </div>
    <div class="metric-tile__bar" aria-hidden="true">
      <span :style="{ width: `${props.item.value}%` }"></span>
    </div>
    <p>{{ props.item.description }}</p>
  </article>
</template>
