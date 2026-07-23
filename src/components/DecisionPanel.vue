<script setup lang="ts">
import type { StatusTone } from '../types/analysis'

interface DecisionPanelProps {
  label: string
  title: string
  score: number
  tone: StatusTone
  summary: string
  recommendation?: string
}

const props = defineProps<DecisionPanelProps>()
</script>

<template>
  <section class="decision-panel" :class="`decision-panel--${props.tone}`">
    <div class="decision-panel__signal">
      <span class="decision-panel__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3 3.8 19.3a1.4 1.4 0 0 0 1.3 2h13.8a1.4 1.4 0 0 0 1.3-2L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </span>
      <div>
        <p class="decision-panel__label">{{ props.label }}</p>
        <h2>{{ props.title }}</h2>
      </div>
    </div>

    <div class="decision-panel__score">
      <strong>{{ props.score }}</strong>
      <span>из 100</span>
    </div>

    <p class="decision-panel__summary">{{ props.summary }}</p>
    <div v-if="props.recommendation" class="decision-panel__recommendation">
      <span>Рекомендация</span>
      <p>{{ props.recommendation }}</p>
    </div>
  </section>
</template>
