<script setup lang="ts">
defineProps<{
  kind: 'timeline' | 'transcript' | 'factors'
  message: string
  loading: boolean
}>()
</script>

<template>
  <div class="analysis-placeholder" :class="[`analysis-placeholder--${kind}`, { 'analysis-placeholder--loading': loading }]" :aria-busy="loading">
    <div class="skeleton-shapes" aria-hidden="true">
      <div v-for="item in (kind === 'timeline' ? 8 : 3)" :key="item" class="skeleton-item">
        <span class="skeleton-line"></span><span v-if="kind !== 'timeline'" class="skeleton-line"></span>
      </div>
    </div>
    <p>{{ message }}</p>
  </div>
</template>
