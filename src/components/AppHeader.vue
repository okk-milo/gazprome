<script setup lang="ts">
import type { AnalysisPage } from '../types/analysis'

interface AppHeaderProps {
  activePage: AnalysisPage
  eyebrow: string
  title: string
}

const props = defineProps<AppHeaderProps>()

const emit = defineEmits<{
  'update:page': [page: AnalysisPage]
}>()

function selectPage(page: AnalysisPage): void {
  emit('update:page', page)
}
</script>

<template>
  <header class="app-header">
    <div class="brand-mark" aria-hidden="true">
      <span></span><span></span><span></span><span></span>
    </div>

    <div class="header-copy">
      <p class="eyebrow">{{ props.eyebrow }}</p>
      <h1>{{ props.title }}</h1>
    </div>

    <nav class="page-switcher" aria-label="Разделы прототипа">
      <button
        class="page-switcher__button"
        :class="{ 'page-switcher__button--active': props.activePage === 'antifraud' }"
        type="button"
        @click="selectPage('antifraud')"
      >
        Антифрод
      </button>
      <button
        class="page-switcher__button"
        :class="{ 'page-switcher__button--active': props.activePage === 'burnout' }"
        type="button"
        @click="selectPage('burnout')"
      >
        Выгорание
      </button>
    </nav>

  </header>
</template>
