<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import { antifraudFallbackData } from './data/antifraud'
import { burnoutFallbackData } from './data/burnout'
import type { AnalysisPage } from './types/analysis'
import AntifraudView from './views/AntifraudView.vue'
import BurnoutView from './views/BurnoutView.vue'

const activePage = ref<AnalysisPage>(readPageFromHash())

const activePageData = computed(() => {
  return activePage.value === 'antifraud' ? antifraudFallbackData : burnoutFallbackData
})

function readPageFromHash(): AnalysisPage {
  return window.location.hash === '#burnout' ? 'burnout' : 'antifraud'
}

function updatePage(page: AnalysisPage): void {
  if (activePage.value === page) {
    return
  }

  activePage.value = page
  window.location.hash = page
}

function syncPageWithHash(): void {
  activePage.value = readPageFromHash()
}

onMounted(() => {
  window.addEventListener('hashchange', syncPageWithHash)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncPageWithHash)
})
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :active-page="activePage"
      :eyebrow="activePageData.eyebrow"
      :title="activePageData.title"
      @update:page="updatePage"
    />

    <AntifraudView v-if="activePage === 'antifraud'" />
    <BurnoutView v-else />
  </div>
</template>
