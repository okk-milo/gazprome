<script setup lang="ts">
import type { EvidenceItem } from '../types/analysis'

interface EvidenceListProps {
  items: EvidenceItem[]
}

const props = defineProps<EvidenceListProps>()

function getConfidencePercent(item: EvidenceItem): number {
  return Math.round(item.confidence * 100)
}
</script>

<template>
  <ol class="evidence-list">
    <li v-for="(item, index) in props.items" :key="item.id" class="evidence-list__item">
      <span class="evidence-list__rank">{{ index + 1 }}</span>
      <div class="evidence-list__content">
        <div class="evidence-list__headline">
          <h3>{{ item.title }}</h3>
          <span :class="`evidence-list__badge evidence-list__badge--${item.tone}`">
            {{ getConfidencePercent(item) }}%
          </span>
        </div>
        <p>{{ item.description }}</p>
        <div class="evidence-list__bar" aria-hidden="true">
          <span
            :class="`evidence-list__bar-fill--${item.tone}`"
            :style="{ width: getConfidencePercent(item) + '%' }"
          ></span>
        </div>
        <blockquote v-if="item.quote">
          <p>{{ item.quote }}</p>
          <cite v-if="item.timestamp">{{ item.timestamp }}</cite>
        </blockquote>
      </div>
    </li>
  </ol>
</template>
