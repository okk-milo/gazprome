<script setup lang="ts">
interface SectionCardProps {
  title: string
  description?: string
  className?: string
}

const props = defineProps<SectionCardProps>()
</script>

<template>
  <section class="section-card" :class="props.className">
    <div class="section-card__header">
      <div>
        <h2>{{ props.title }}</h2>
        <p v-if="props.description" class="section-card__description">
          {{ props.description }}
        </p>
      </div>
      <slot name="action"></slot>
    </div>
    <div class="section-card__body">
      <slot></slot>
    </div>
  </section>
</template>
