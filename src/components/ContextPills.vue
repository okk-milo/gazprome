<script setup lang="ts">
import type { ContextItem } from '../types/analysis'

interface ContextPillsProps {
  items: ContextItem[]
}

const props = defineProps<ContextPillsProps>()
</script>

<template>
  <div class="context-pills" aria-label="Контекст анализа">
    <article
      v-for="item in props.items"
      :key="item.label"
      class="context-pill"
      :class="item.tone ? `context-pill--${item.tone}` : ''"
    >
      <p>{{ item.label }}</p>
      <strong>{{ item.value }}</strong>
      <span>{{ item.description }}</span>
    </article>
  </div>
</template>
